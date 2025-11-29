//! Token Vault Contract for Casper Ignite (MVP)
//!
//! This contract provides trustless escrow functionality for the trading platform.
//! It holds CSPR in escrow for pending orders, enabling decentralized trading.
//!
//! # Entry Points
//! - `lock_cspr`: Lock CSPR for a buy order
//! - `unlock_cspr`: Unlock CSPR (admin only, for trade execution)
//! - `cancel_order`: Cancel an order and refund locked CSPR
//! - `set_order_book`: Set the authorized order book contract
//! - `get_locked_amount`: Query locked amount for an order

#![no_std]
#![no_main]

#[cfg(not(target_arch = "wasm32"))]
compile_error!("target arch should be wasm32: compile with '--target wasm32-unknown-unknown'");

extern crate alloc;

use alloc::string::{String, ToString};
use alloc::vec;
use casper_contract::{
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    account::AccountHash,
    contracts::{EntryPoint, EntryPoints, NamedKeys},
    ApiError, CLType, CLValue, EntryPointAccess, EntryPointType, Parameter, URef, U512,
};

// ============================================================================
// Error Codes
// ============================================================================

#[repr(u16)]
pub enum VaultError {
    InsufficientBalance = 1,
    OrderNotFound = 2,
    NotOrderOwner = 3,
    NotAuthorized = 4,
    AlreadyLocked = 5,
    InvalidAmount = 6,
    TransferFailed = 7,
    MissingKey = 10,
}

impl From<VaultError> for ApiError {
    fn from(e: VaultError) -> Self {
        ApiError::User(e as u16)
    }
}

// ============================================================================
// Constants
// ============================================================================

const CONTRACT_NAME: &str = "token_vault";
const CONTRACT_HASH_KEY: &str = "token_vault_hash";
const CONTRACT_PACKAGE_KEY: &str = "token_vault_package";
const KEY_ADMIN: &str = "admin";
const KEY_ORDER_BOOK: &str = "order_book";
const KEY_CSPR_PURSE: &str = "cspr_purse";
const DICT_LOCKED_CSPR: &str = "locked_cspr";
const DICT_ORDER_OWNERS: &str = "order_owners";

// Entry point names
const EP_LOCK_CSPR: &str = "lock_cspr";
const EP_UNLOCK_CSPR: &str = "unlock_cspr";
const EP_CANCEL_ORDER: &str = "cancel_order";
const EP_SET_ORDER_BOOK: &str = "set_order_book";
const EP_GET_LOCKED_AMOUNT: &str = "get_locked_amount";

// ============================================================================
// Helper Functions
// ============================================================================

fn get_uref(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert_with(VaultError::MissingKey)
        .into_uref()
        .unwrap_or_revert()
}

fn get_admin() -> AccountHash {
    let admin_uref = get_uref(KEY_ADMIN);
    storage::read(admin_uref)
        .unwrap_or_revert()
        .unwrap_or_revert()
}

fn only_admin() {
    let caller = runtime::get_caller();
    let admin = get_admin();
    if caller != admin {
        runtime::revert(VaultError::NotAuthorized);
    }
}

fn only_order_book_or_admin() {
    let caller = runtime::get_caller();
    let admin = get_admin();
    if caller == admin {
        return;
    }

    if let Some(key) = runtime::get_key(KEY_ORDER_BOOK) {
        let order_book_uref = key.into_uref().unwrap_or_revert();
        let order_book: AccountHash = storage::read(order_book_uref)
            .unwrap_or_revert()
            .unwrap_or(AccountHash::default());

        if caller == order_book && order_book != AccountHash::default() {
            return;
        }
    }

    runtime::revert(VaultError::NotAuthorized);
}

// ============================================================================
// Entry Points Implementation
// ============================================================================

/// Lock CSPR for a buy order
/// Anyone can call this to lock their CSPR
#[no_mangle]
pub extern "C" fn lock_cspr() {
    let caller = runtime::get_caller();
    let order_id: String = runtime::get_named_arg("order_id");
    let amount: U512 = runtime::get_named_arg("amount");

    if amount == U512::zero() {
        runtime::revert(VaultError::InvalidAmount);
    }

    // Check if order already exists
    let locked_cspr_uref = get_uref(DICT_LOCKED_CSPR);
    let existing: Option<U512> = storage::dictionary_get(locked_cspr_uref, &order_id)
        .unwrap_or_revert();

    if existing.is_some() {
        runtime::revert(VaultError::AlreadyLocked);
    }

    // Get payment purse from caller and transfer to vault purse
    let source_purse: URef = runtime::get_named_arg("payment_purse");
    let vault_purse = get_uref(KEY_CSPR_PURSE);

    system::transfer_from_purse_to_purse(source_purse, vault_purse, amount, None)
        .unwrap_or_revert_with(VaultError::TransferFailed);

    // Store locked amount
    storage::dictionary_put(locked_cspr_uref, &order_id, amount);

    // Store order owner
    let order_owners_uref = get_uref(DICT_ORDER_OWNERS);
    storage::dictionary_put(order_owners_uref, &order_id, caller);
}

/// Unlock CSPR and send to recipient (for trade execution)
/// Only callable by order_book contract or admin
#[no_mangle]
pub extern "C" fn unlock_cspr() {
    only_order_book_or_admin();

    let order_id: String = runtime::get_named_arg("order_id");
    let recipient: AccountHash = runtime::get_named_arg("recipient");
    let amount: U512 = runtime::get_named_arg("amount");

    let locked_cspr_uref = get_uref(DICT_LOCKED_CSPR);

    // Get locked amount
    let locked: U512 = storage::dictionary_get(locked_cspr_uref, &order_id)
        .unwrap_or_revert()
        .unwrap_or_revert_with(VaultError::OrderNotFound);

    if locked < amount {
        runtime::revert(VaultError::InsufficientBalance);
    }

    // Transfer CSPR to recipient
    let vault_purse = get_uref(KEY_CSPR_PURSE);
    system::transfer_from_purse_to_account(vault_purse, recipient, amount, None)
        .unwrap_or_revert_with(VaultError::TransferFailed);

    // Update or remove locked amount
    let remaining = locked - amount;
    storage::dictionary_put(locked_cspr_uref, &order_id, remaining);
}

/// Cancel an order and refund locked CSPR
/// Only the order owner can cancel their own order
#[no_mangle]
pub extern "C" fn cancel_order() {
    let caller = runtime::get_caller();
    let order_id: String = runtime::get_named_arg("order_id");

    // Check order owner
    let order_owners_uref = get_uref(DICT_ORDER_OWNERS);
    let owner: AccountHash = storage::dictionary_get(order_owners_uref, &order_id)
        .unwrap_or_revert()
        .unwrap_or_revert_with(VaultError::OrderNotFound);

    if owner != caller {
        runtime::revert(VaultError::NotOrderOwner);
    }

    // Get locked amount
    let locked_cspr_uref = get_uref(DICT_LOCKED_CSPR);
    let locked: U512 = storage::dictionary_get(locked_cspr_uref, &order_id)
        .unwrap_or_revert()
        .unwrap_or(U512::zero());

    if locked > U512::zero() {
        // Refund CSPR
        let vault_purse = get_uref(KEY_CSPR_PURSE);
        system::transfer_from_purse_to_account(vault_purse, caller, locked, None)
            .unwrap_or_revert_with(VaultError::TransferFailed);

        // Clear locked amount
        storage::dictionary_put(locked_cspr_uref, &order_id, U512::zero());
    }
}

/// Set the order book contract that can call unlock_cspr
/// Only callable by admin
#[no_mangle]
pub extern "C" fn set_order_book() {
    only_admin();

    let order_book: AccountHash = runtime::get_named_arg("order_book");
    let order_book_uref = get_uref(KEY_ORDER_BOOK);
    storage::write(order_book_uref, order_book);
}

/// Get locked CSPR for an order
#[no_mangle]
pub extern "C" fn get_locked_amount() {
    let order_id: String = runtime::get_named_arg("order_id");

    let locked_cspr_uref = get_uref(DICT_LOCKED_CSPR);
    let locked: U512 = storage::dictionary_get(locked_cspr_uref, &order_id)
        .unwrap_or_revert()
        .unwrap_or(U512::zero());

    runtime::ret(CLValue::from_t(locked).unwrap_or_revert());
}

// ============================================================================
// Contract Installation
// ============================================================================

fn build_entry_points() -> EntryPoints {
    let mut entry_points = EntryPoints::new();

    // lock_cspr - anyone can call
    entry_points.add_entry_point(EntryPoint::new(
        EP_LOCK_CSPR,
        vec![
            Parameter::new("order_id", CLType::String),
            Parameter::new("amount", CLType::U512),
            Parameter::new("payment_purse", CLType::URef),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // unlock_cspr - admin or order_book only (checked in code)
    entry_points.add_entry_point(EntryPoint::new(
        EP_UNLOCK_CSPR,
        vec![
            Parameter::new("order_id", CLType::String),
            Parameter::new("recipient", CLType::ByteArray(32)),
            Parameter::new("amount", CLType::U512),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // cancel_order - owner only (checked in code)
    entry_points.add_entry_point(EntryPoint::new(
        EP_CANCEL_ORDER,
        vec![Parameter::new("order_id", CLType::String)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // set_order_book - admin only
    entry_points.add_entry_point(EntryPoint::new(
        EP_SET_ORDER_BOOK,
        vec![Parameter::new("order_book", CLType::ByteArray(32))],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // get_locked_amount - anyone can call
    entry_points.add_entry_point(EntryPoint::new(
        EP_GET_LOCKED_AMOUNT,
        vec![Parameter::new("order_id", CLType::String)],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points
}

#[no_mangle]
pub extern "C" fn call() {
    let admin: AccountHash = runtime::get_named_arg("admin");

    // Create purse for holding CSPR
    let cspr_purse = system::create_purse();

    // Create dictionaries
    let locked_cspr_uref = storage::new_dictionary(DICT_LOCKED_CSPR).unwrap_or_revert();
    let order_owners_uref = storage::new_dictionary(DICT_ORDER_OWNERS).unwrap_or_revert();

    // Store admin
    let admin_uref = storage::new_uref(admin);

    // Store order book (initially default)
    let order_book_uref = storage::new_uref(AccountHash::default());

    // Build named keys for contract
    let mut named_keys = NamedKeys::new();
    named_keys.insert(KEY_ADMIN.to_string(), admin_uref.into());
    named_keys.insert(KEY_ORDER_BOOK.to_string(), order_book_uref.into());
    named_keys.insert(KEY_CSPR_PURSE.to_string(), cspr_purse.into());
    named_keys.insert(DICT_LOCKED_CSPR.to_string(), locked_cspr_uref.into());
    named_keys.insert(DICT_ORDER_OWNERS.to_string(), order_owners_uref.into());

    // Create entry points
    let entry_points = build_entry_points();

    // Install the contract
    let (contract_hash, _contract_version) = storage::new_contract(
        entry_points.into(),
        Some(named_keys),
        Some(CONTRACT_PACKAGE_KEY.to_string()),
        Some(CONTRACT_NAME.to_string()),
        None, // No message topics
    );

    // Store the contract hash for reference
    runtime::put_key(CONTRACT_HASH_KEY, contract_hash.into());
}
