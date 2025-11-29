//! Bonding Curve AMM Contract for Casper Ignite
//!
//! This contract implements a linear bonding curve for instant token buy/sell.
//! Formula: price(supply) = initialPrice + (slope × supply)
//! Where: slope = initialPrice × reserveRatio / SCALE
//!
//! # Entry Points
//! - `initialize`: Set up the AMM with curve parameters
//! - `buy`: Buy tokens with CSPR
//! - `sell`: Sell tokens for CSPR
//! - `get_price`: Query current price
//! - `get_balance`: Query user's token balance
//! - `get_reserve`: Query CSPR reserve
//! - `deposit_reserve`: Add initial CSPR liquidity
//! - `admin_withdraw`: Admin withdraws excess CSPR

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
pub enum AmmError {
    NotAuthorized = 1,
    AlreadyInitialized = 2,
    NotInitialized = 3,
    InsufficientPayment = 4,
    InsufficientTokens = 5,
    InsufficientReserve = 6,
    InvalidAmount = 7,
    TransferFailed = 8,
    MathOverflow = 9,
    MissingKey = 10,
    SlippageExceeded = 11,
}

impl From<AmmError> for ApiError {
    fn from(e: AmmError) -> Self {
        ApiError::User(e as u16)
    }
}

// ============================================================================
// Constants
// ============================================================================

const CONTRACT_NAME: &str = "bonding_curve_amm";
const CONTRACT_HASH_KEY: &str = "bonding_curve_amm_hash";
const CONTRACT_PACKAGE_KEY: &str = "bonding_curve_amm_package";

// Storage keys
const KEY_ADMIN: &str = "admin";
const KEY_CSPR_PURSE: &str = "cspr_reserve";
const KEY_TOTAL_SUPPLY: &str = "total_supply";
const KEY_INITIAL_PRICE: &str = "initial_price";
const KEY_RESERVE_RATIO: &str = "reserve_ratio";
const KEY_INITIALIZED: &str = "initialized";
const DICT_BALANCES: &str = "token_balances";

// Entry point names
const EP_INITIALIZE: &str = "initialize";
const EP_BUY: &str = "buy";
const EP_SELL: &str = "sell";
const EP_GET_PRICE: &str = "get_price";
const EP_GET_BALANCE: &str = "get_balance";
const EP_GET_RESERVE: &str = "get_reserve";
const EP_GET_SUPPLY: &str = "get_supply";
const EP_DEPOSIT_RESERVE: &str = "deposit_reserve";
const EP_ADMIN_WITHDRAW: &str = "admin_withdraw";

// Fixed-point scale (10^9 = 1 CSPR in motes)
const SCALE: u64 = 1_000_000_000;

// ============================================================================
// Helper Functions
// ============================================================================

fn get_uref(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert_with(AmmError::MissingKey)
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
        runtime::revert(AmmError::NotAuthorized);
    }
}

fn is_initialized() -> bool {
    let init_uref = get_uref(KEY_INITIALIZED);
    storage::read::<bool>(init_uref)
        .unwrap_or_revert()
        .unwrap_or(false)
}

fn get_total_supply() -> U512 {
    let supply_uref = get_uref(KEY_TOTAL_SUPPLY);
    storage::read(supply_uref)
        .unwrap_or_revert()
        .unwrap_or(U512::zero())
}

fn set_total_supply(supply: U512) {
    let supply_uref = get_uref(KEY_TOTAL_SUPPLY);
    storage::write(supply_uref, supply);
}

fn get_initial_price() -> U512 {
    let price_uref = get_uref(KEY_INITIAL_PRICE);
    storage::read(price_uref)
        .unwrap_or_revert()
        .unwrap_or(U512::zero())
}

fn get_reserve_ratio() -> U512 {
    let ratio_uref = get_uref(KEY_RESERVE_RATIO);
    storage::read(ratio_uref)
        .unwrap_or_revert()
        .unwrap_or(U512::zero())
}

/// Calculate price at current supply level
/// price = initialPrice + (slope × supply)
/// slope = initialPrice × reserveRatio / (SCALE × 10000)
fn calculate_price(supply: U512) -> U512 {
    let initial_price = get_initial_price();
    let reserve_ratio = get_reserve_ratio();

    // slope = initialPrice * reserveRatio / (10000 * SCALE)
    // For simplicity: slope_scaled = initialPrice * reserveRatio / 10000
    // price = initialPrice + (slope_scaled * supply) / SCALE
    let slope_numerator = initial_price * reserve_ratio;
    let slope_per_token = slope_numerator / U512::from(10000u64);

    // price = initialPrice + (slope_per_token * supply) / SCALE
    let price_increase = (slope_per_token * supply) / U512::from(SCALE);
    initial_price + price_increase
}

/// Calculate cost to buy `amount` tokens using integration
/// Cost = ∫ price(s) ds from current_supply to current_supply + amount
/// Cost = initialPrice × amount + slope × (S₂² - S₁²) / 2
fn calculate_buy_cost(amount: U512) -> U512 {
    let supply = get_total_supply();
    let initial_price = get_initial_price();
    let reserve_ratio = get_reserve_ratio();

    // slope_numerator = initialPrice * reserveRatio
    let slope_numerator = initial_price * reserve_ratio;

    // Linear part: initialPrice * amount
    let linear_cost = initial_price * amount;

    // Quadratic part: slope * (S2² - S1²) / 2
    // = slope_numerator * ((supply + amount)² - supply²) / (2 * 10000 * SCALE)
    let s1 = supply;
    let s2 = supply + amount;
    let s2_squared = s2 * s2;
    let s1_squared = s1 * s1;
    let diff_squared = s2_squared - s1_squared;

    // quadratic_cost = slope_numerator * diff_squared / (20000 * SCALE)
    let quadratic_cost = (slope_numerator * diff_squared)
        / U512::from(20000u64 * SCALE);

    linear_cost + quadratic_cost
}

/// Calculate proceeds from selling `amount` tokens using integration
fn calculate_sell_proceeds(amount: U512) -> U512 {
    let supply = get_total_supply();
    let initial_price = get_initial_price();
    let reserve_ratio = get_reserve_ratio();

    if supply < amount {
        runtime::revert(AmmError::InsufficientTokens);
    }

    let slope_numerator = initial_price * reserve_ratio;

    // Linear part: initialPrice * amount
    let linear_proceeds = initial_price * amount;

    // Quadratic part: slope * (S1² - S2²) / 2
    let s1 = supply;
    let s2 = supply - amount;
    let s1_squared = s1 * s1;
    let s2_squared = s2 * s2;
    let diff_squared = s1_squared - s2_squared;

    let quadratic_proceeds = (slope_numerator * diff_squared)
        / U512::from(20000u64 * SCALE);

    linear_proceeds + quadratic_proceeds
}

fn get_user_balance(account: AccountHash) -> U512 {
    let balances_uref = get_uref(DICT_BALANCES);
    let key = account.to_string();
    storage::dictionary_get::<U512>(balances_uref, &key)
        .unwrap_or_revert()
        .unwrap_or(U512::zero())
}

fn set_user_balance(account: AccountHash, balance: U512) {
    let balances_uref = get_uref(DICT_BALANCES);
    let key = account.to_string();
    storage::dictionary_put(balances_uref, &key, balance);
}

// ============================================================================
// Entry Points Implementation
// ============================================================================

/// Initialize the AMM with curve parameters
#[no_mangle]
pub extern "C" fn initialize() {
    only_admin();

    if is_initialized() {
        runtime::revert(AmmError::AlreadyInitialized);
    }

    let initial_price: U512 = runtime::get_named_arg("initial_price");
    let reserve_ratio: U512 = runtime::get_named_arg("reserve_ratio");

    if initial_price == U512::zero() {
        runtime::revert(AmmError::InvalidAmount);
    }

    // Store parameters
    let price_uref = get_uref(KEY_INITIAL_PRICE);
    storage::write(price_uref, initial_price);

    let ratio_uref = get_uref(KEY_RESERVE_RATIO);
    storage::write(ratio_uref, reserve_ratio);

    // Mark as initialized
    let init_uref = get_uref(KEY_INITIALIZED);
    storage::write(init_uref, true);
}

/// Buy tokens with CSPR
#[no_mangle]
pub extern "C" fn buy() {
    if !is_initialized() {
        runtime::revert(AmmError::NotInitialized);
    }

    let caller = runtime::get_caller();
    let token_amount: U512 = runtime::get_named_arg("token_amount");
    let max_cost: U512 = runtime::get_named_arg("max_cost");
    let payment_purse: URef = runtime::get_named_arg("payment_purse");

    if token_amount == U512::zero() {
        runtime::revert(AmmError::InvalidAmount);
    }

    // Calculate cost
    let cost = calculate_buy_cost(token_amount);

    // Check slippage
    if cost > max_cost {
        runtime::revert(AmmError::SlippageExceeded);
    }

    // Transfer CSPR from buyer to reserve
    let reserve_purse = get_uref(KEY_CSPR_PURSE);
    system::transfer_from_purse_to_purse(payment_purse, reserve_purse, cost, None)
        .unwrap_or_revert_with(AmmError::TransferFailed);

    // Update supply
    let new_supply = get_total_supply() + token_amount;
    set_total_supply(new_supply);

    // Update buyer's balance
    let current_balance = get_user_balance(caller);
    set_user_balance(caller, current_balance + token_amount);
}

/// Sell tokens for CSPR
#[no_mangle]
pub extern "C" fn sell() {
    if !is_initialized() {
        runtime::revert(AmmError::NotInitialized);
    }

    let caller = runtime::get_caller();
    let token_amount: U512 = runtime::get_named_arg("token_amount");
    let min_proceeds: U512 = runtime::get_named_arg("min_proceeds");

    if token_amount == U512::zero() {
        runtime::revert(AmmError::InvalidAmount);
    }

    // Check user has enough tokens
    let current_balance = get_user_balance(caller);
    if current_balance < token_amount {
        runtime::revert(AmmError::InsufficientTokens);
    }

    // Calculate proceeds
    let proceeds = calculate_sell_proceeds(token_amount);

    // Check slippage
    if proceeds < min_proceeds {
        runtime::revert(AmmError::SlippageExceeded);
    }

    // Check reserve has enough CSPR
    let reserve_purse = get_uref(KEY_CSPR_PURSE);
    let reserve_balance = system::get_purse_balance(reserve_purse)
        .unwrap_or_revert_with(AmmError::MissingKey);

    if reserve_balance < proceeds {
        runtime::revert(AmmError::InsufficientReserve);
    }

    // Update seller's balance first
    set_user_balance(caller, current_balance - token_amount);

    // Update supply
    let new_supply = get_total_supply() - token_amount;
    set_total_supply(new_supply);

    // Transfer CSPR from reserve to seller
    system::transfer_from_purse_to_account(reserve_purse, caller, proceeds, None)
        .unwrap_or_revert_with(AmmError::TransferFailed);
}

/// Get current price for 1 token
#[no_mangle]
pub extern "C" fn get_price() {
    let supply = get_total_supply();
    let price = calculate_price(supply);
    runtime::ret(CLValue::from_t(price).unwrap_or_revert());
}

/// Get user's token balance
#[no_mangle]
pub extern "C" fn get_balance() {
    let account: AccountHash = runtime::get_named_arg("account");
    let balance = get_user_balance(account);
    runtime::ret(CLValue::from_t(balance).unwrap_or_revert());
}

/// Get CSPR reserve balance
#[no_mangle]
pub extern "C" fn get_reserve() {
    let reserve_purse = get_uref(KEY_CSPR_PURSE);
    let balance = system::get_purse_balance(reserve_purse)
        .unwrap_or_revert_with(AmmError::MissingKey);
    runtime::ret(CLValue::from_t(balance).unwrap_or_revert());
}

/// Get total token supply (tokens in circulation)
#[no_mangle]
pub extern "C" fn get_supply() {
    let supply = get_total_supply();
    runtime::ret(CLValue::from_t(supply).unwrap_or_revert());
}

/// Deposit initial CSPR reserve (admin only)
#[no_mangle]
pub extern "C" fn deposit_reserve() {
    only_admin();

    let payment_purse: URef = runtime::get_named_arg("payment_purse");
    let amount: U512 = runtime::get_named_arg("amount");

    if amount == U512::zero() {
        runtime::revert(AmmError::InvalidAmount);
    }

    let reserve_purse = get_uref(KEY_CSPR_PURSE);
    system::transfer_from_purse_to_purse(payment_purse, reserve_purse, amount, None)
        .unwrap_or_revert_with(AmmError::TransferFailed);
}

/// Admin withdraw excess CSPR from reserve
#[no_mangle]
pub extern "C" fn admin_withdraw() {
    only_admin();

    let amount: U512 = runtime::get_named_arg("amount");
    let recipient: AccountHash = runtime::get_named_arg("recipient");

    let reserve_purse = get_uref(KEY_CSPR_PURSE);
    let balance = system::get_purse_balance(reserve_purse)
        .unwrap_or_revert_with(AmmError::MissingKey);

    if balance < amount {
        runtime::revert(AmmError::InsufficientReserve);
    }

    system::transfer_from_purse_to_account(reserve_purse, recipient, amount, None)
        .unwrap_or_revert_with(AmmError::TransferFailed);
}

// ============================================================================
// Contract Installation
// ============================================================================

fn build_entry_points() -> EntryPoints {
    let mut entry_points = EntryPoints::new();

    // initialize - admin only
    entry_points.add_entry_point(EntryPoint::new(
        EP_INITIALIZE,
        vec![
            Parameter::new("initial_price", CLType::U512),
            Parameter::new("reserve_ratio", CLType::U512),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // buy - anyone can call
    entry_points.add_entry_point(EntryPoint::new(
        EP_BUY,
        vec![
            Parameter::new("token_amount", CLType::U512),
            Parameter::new("max_cost", CLType::U512),
            Parameter::new("payment_purse", CLType::URef),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // sell - anyone can call
    entry_points.add_entry_point(EntryPoint::new(
        EP_SELL,
        vec![
            Parameter::new("token_amount", CLType::U512),
            Parameter::new("min_proceeds", CLType::U512),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // get_price - view function
    entry_points.add_entry_point(EntryPoint::new(
        EP_GET_PRICE,
        vec![],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // get_balance - view function
    entry_points.add_entry_point(EntryPoint::new(
        EP_GET_BALANCE,
        vec![Parameter::new("account", CLType::ByteArray(32))],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // get_reserve - view function
    entry_points.add_entry_point(EntryPoint::new(
        EP_GET_RESERVE,
        vec![],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // get_supply - view function
    entry_points.add_entry_point(EntryPoint::new(
        EP_GET_SUPPLY,
        vec![],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // deposit_reserve - admin only
    entry_points.add_entry_point(EntryPoint::new(
        EP_DEPOSIT_RESERVE,
        vec![
            Parameter::new("payment_purse", CLType::URef),
            Parameter::new("amount", CLType::U512),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // admin_withdraw - admin only
    entry_points.add_entry_point(EntryPoint::new(
        EP_ADMIN_WITHDRAW,
        vec![
            Parameter::new("amount", CLType::U512),
            Parameter::new("recipient", CLType::ByteArray(32)),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points
}

#[no_mangle]
pub extern "C" fn call() {
    let admin: AccountHash = runtime::get_named_arg("admin");

    // Create purse for CSPR reserves
    let cspr_purse = system::create_purse();

    // Create dictionary for token balances
    let balances_uref = storage::new_dictionary(DICT_BALANCES).unwrap_or_revert();

    // Create storage for parameters
    let admin_uref = storage::new_uref(admin);
    let supply_uref = storage::new_uref(U512::zero());
    let price_uref = storage::new_uref(U512::zero());
    let ratio_uref = storage::new_uref(U512::zero());
    let init_uref = storage::new_uref(false);

    // Build named keys for contract
    let mut named_keys = NamedKeys::new();
    named_keys.insert(KEY_ADMIN.to_string(), admin_uref.into());
    named_keys.insert(KEY_CSPR_PURSE.to_string(), cspr_purse.into());
    named_keys.insert(KEY_TOTAL_SUPPLY.to_string(), supply_uref.into());
    named_keys.insert(KEY_INITIAL_PRICE.to_string(), price_uref.into());
    named_keys.insert(KEY_RESERVE_RATIO.to_string(), ratio_uref.into());
    named_keys.insert(KEY_INITIALIZED.to_string(), init_uref.into());
    named_keys.insert(DICT_BALANCES.to_string(), balances_uref.into());

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
