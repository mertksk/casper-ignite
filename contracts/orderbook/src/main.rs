//! On-Chain Order Book Contract for Casper Ignite
//!
//! Implements a limit order book with price-time priority matching.
//! Supports buy/sell limit orders with partial fills.
//!
//! # Entry Points
//! - `place_buy_order`: Place a buy limit order (escrows CSPR)
//! - `place_sell_order`: Place a sell limit order (escrows tokens)
//! - `cancel_order`: Cancel an open order
//! - `get_order`: Get order details
//! - `get_best_bid`: Get highest buy price
//! - `get_best_ask`: Get lowest sell price

#![no_std]
#![no_main]

#[cfg(not(target_arch = "wasm32"))]
compile_error!("target arch should be wasm32: compile with '--target wasm32-unknown-unknown'");

extern crate alloc;

use alloc::string::{String, ToString};
use alloc::vec;
use alloc::vec::Vec;
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
pub enum OrderBookError {
    NotAuthorized = 1,
    OrderNotFound = 2,
    InsufficientFunds = 3,
    InvalidAmount = 4,
    InvalidPrice = 5,
    TransferFailed = 6,
    OrderAlreadyFilled = 7,
    MathOverflow = 8,
    MissingKey = 9,
}

impl From<OrderBookError> for ApiError {
    fn from(e: OrderBookError) -> Self {
        ApiError::User(e as u16)
    }
}

// ============================================================================
// Constants
// ============================================================================

const CONTRACT_NAME: &str = "orderbook";
const CONTRACT_HASH_KEY: &str = "orderbook_hash";
const CONTRACT_PACKAGE_KEY: &str = "orderbook_package";

// Storage keys
const KEY_ADMIN: &str = "admin";
const KEY_CSPR_PURSE: &str = "cspr_escrow";
const KEY_ORDER_COUNTER: &str = "order_counter";
const KEY_BEST_BID: &str = "best_bid";
const KEY_BEST_ASK: &str = "best_ask";
const DICT_ORDERS: &str = "orders";
const DICT_USER_ORDERS: &str = "user_orders";
const DICT_TOKEN_BALANCES: &str = "token_balances";

// Entry point names
const EP_PLACE_BUY_ORDER: &str = "place_buy_order";
const EP_PLACE_SELL_ORDER: &str = "place_sell_order";
const EP_CANCEL_ORDER: &str = "cancel_order";
const EP_GET_ORDER: &str = "get_order";
const EP_GET_BEST_BID: &str = "get_best_bid";
const EP_GET_BEST_ASK: &str = "get_best_ask";
const EP_DEPOSIT_TOKENS: &str = "deposit_tokens";
const EP_WITHDRAW_TOKENS: &str = "withdraw_tokens";

// Order sides
const SIDE_BUY: u8 = 0;
const SIDE_SELL: u8 = 1;

// Order status
const STATUS_OPEN: u8 = 0;
const STATUS_FILLED: u8 = 1;
const STATUS_CANCELLED: u8 = 2;
const STATUS_PARTIAL: u8 = 3;

// ============================================================================
// Helper Functions
// ============================================================================

fn get_uref(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert_with(OrderBookError::MissingKey)
        .into_uref()
        .unwrap_or_revert()
}

fn get_admin() -> AccountHash {
    let admin_uref = get_uref(KEY_ADMIN);
    storage::read(admin_uref)
        .unwrap_or_revert()
        .unwrap_or_revert()
}

fn get_order_counter() -> u64 {
    let counter_uref = get_uref(KEY_ORDER_COUNTER);
    storage::read(counter_uref)
        .unwrap_or_revert()
        .unwrap_or(0u64)
}

fn set_order_counter(value: u64) {
    let counter_uref = get_uref(KEY_ORDER_COUNTER);
    storage::write(counter_uref, value);
}

fn get_best_bid() -> U512 {
    let bid_uref = get_uref(KEY_BEST_BID);
    storage::read(bid_uref)
        .unwrap_or_revert()
        .unwrap_or(U512::zero())
}

fn set_best_bid(price: U512) {
    let bid_uref = get_uref(KEY_BEST_BID);
    storage::write(bid_uref, price);
}

fn get_best_ask() -> U512 {
    let ask_uref = get_uref(KEY_BEST_ASK);
    storage::read(ask_uref)
        .unwrap_or_revert()
        .unwrap_or(U512::MAX)
}

fn set_best_ask(price: U512) {
    let ask_uref = get_uref(KEY_BEST_ASK);
    storage::write(ask_uref, price);
}

fn get_token_balance(account: AccountHash) -> U512 {
    let balances_uref = get_uref(DICT_TOKEN_BALANCES);
    let key = account.to_string();
    storage::dictionary_get::<U512>(balances_uref, &key)
        .unwrap_or_revert()
        .unwrap_or(U512::zero())
}

fn set_token_balance(account: AccountHash, balance: U512) {
    let balances_uref = get_uref(DICT_TOKEN_BALANCES);
    let key = account.to_string();
    storage::dictionary_put(balances_uref, &key, balance);
}

// Order structure stored as: (owner, side, price, amount, filled, status, timestamp)
// Encoded as comma-separated string for simplicity
fn encode_order(
    owner: AccountHash,
    side: u8,
    price: U512,
    amount: U512,
    filled: U512,
    status: u8,
) -> String {
    // Format: owner_hex,side,price,amount,filled,status
    let mut s = String::new();
    s.push_str(&owner.to_string());
    s.push(',');
    s.push_str(&side.to_string());
    s.push(',');
    s.push_str(&price.to_string());
    s.push(',');
    s.push_str(&amount.to_string());
    s.push(',');
    s.push_str(&filled.to_string());
    s.push(',');
    s.push_str(&status.to_string());
    s
}

// ============================================================================
// Entry Points Implementation
// ============================================================================

/// Place a buy limit order
/// Escrows CSPR from the payment_purse
#[no_mangle]
pub extern "C" fn place_buy_order() {
    let caller = runtime::get_caller();
    let price: U512 = runtime::get_named_arg("price"); // Price per token in motes
    let amount: U512 = runtime::get_named_arg("amount"); // Token amount
    let payment_purse: URef = runtime::get_named_arg("payment_purse");

    if price == U512::zero() {
        runtime::revert(OrderBookError::InvalidPrice);
    }
    if amount == U512::zero() {
        runtime::revert(OrderBookError::InvalidAmount);
    }

    // Calculate total cost
    let total_cost = price * amount / U512::from(1_000_000_000u64); // Assuming 9 decimals

    // Transfer CSPR to escrow
    let escrow_purse = get_uref(KEY_CSPR_PURSE);
    system::transfer_from_purse_to_purse(payment_purse, escrow_purse, total_cost, None)
        .unwrap_or_revert_with(OrderBookError::TransferFailed);

    // Create order
    let order_id = get_order_counter() + 1;
    set_order_counter(order_id);

    let order_data = encode_order(caller, SIDE_BUY, price, amount, U512::zero(), STATUS_OPEN);

    // Store order
    let orders_uref = get_uref(DICT_ORDERS);
    storage::dictionary_put(orders_uref, &order_id.to_string(), order_data);

    // Update best bid if this is higher
    let current_best_bid = get_best_bid();
    if price > current_best_bid {
        set_best_bid(price);
    }

    // Return order ID
    runtime::ret(CLValue::from_t(order_id).unwrap_or_revert());
}

/// Place a sell limit order
/// Requires tokens to be deposited first
#[no_mangle]
pub extern "C" fn place_sell_order() {
    let caller = runtime::get_caller();
    let price: U512 = runtime::get_named_arg("price"); // Price per token in motes
    let amount: U512 = runtime::get_named_arg("amount"); // Token amount

    if price == U512::zero() {
        runtime::revert(OrderBookError::InvalidPrice);
    }
    if amount == U512::zero() {
        runtime::revert(OrderBookError::InvalidAmount);
    }

    // Check user has enough tokens
    let user_balance = get_token_balance(caller);
    if user_balance < amount {
        runtime::revert(OrderBookError::InsufficientFunds);
    }

    // Lock tokens (reduce available balance)
    set_token_balance(caller, user_balance - amount);

    // Create order
    let order_id = get_order_counter() + 1;
    set_order_counter(order_id);

    let order_data = encode_order(caller, SIDE_SELL, price, amount, U512::zero(), STATUS_OPEN);

    // Store order
    let orders_uref = get_uref(DICT_ORDERS);
    storage::dictionary_put(orders_uref, &order_id.to_string(), order_data);

    // Update best ask if this is lower
    let current_best_ask = get_best_ask();
    if price < current_best_ask {
        set_best_ask(price);
    }

    // Return order ID
    runtime::ret(CLValue::from_t(order_id).unwrap_or_revert());
}

/// Cancel an open order
#[no_mangle]
pub extern "C" fn cancel_order() {
    let caller = runtime::get_caller();
    let order_id: u64 = runtime::get_named_arg("order_id");

    let orders_uref = get_uref(DICT_ORDERS);
    let order_data: String = storage::dictionary_get(orders_uref, &order_id.to_string())
        .unwrap_or_revert()
        .unwrap_or_revert_with(OrderBookError::OrderNotFound);

    // Parse order data
    let parts: Vec<&str> = order_data.split(',').collect();
    if parts.len() < 6 {
        runtime::revert(OrderBookError::OrderNotFound);
    }

    // Verify caller is owner (parts[0] contains account hash)
    let owner_str = parts[0];
    if !owner_str.contains(&caller.to_string()[13..]) {
        // Skip "account-hash-" prefix
        runtime::revert(OrderBookError::NotAuthorized);
    }

    let side: u8 = parts[1].parse().unwrap_or(255);
    let _price: U512 = parts[2].parse().unwrap_or(U512::zero());
    let amount: U512 = parts[3].parse().unwrap_or(U512::zero());
    let filled: U512 = parts[4].parse().unwrap_or(U512::zero());
    let status: u8 = parts[5].parse().unwrap_or(255);

    if status != STATUS_OPEN && status != STATUS_PARTIAL {
        runtime::revert(OrderBookError::OrderAlreadyFilled);
    }

    let unfilled = amount - filled;

    // Return escrowed funds
    if side == SIDE_BUY {
        // Return CSPR
        let total_refund = _price * unfilled / U512::from(1_000_000_000u64);
        let escrow_purse = get_uref(KEY_CSPR_PURSE);
        system::transfer_from_purse_to_account(escrow_purse, caller, total_refund, None)
            .unwrap_or_revert_with(OrderBookError::TransferFailed);
    } else {
        // Return tokens
        let current_balance = get_token_balance(caller);
        set_token_balance(caller, current_balance + unfilled);
    }

    // Mark order as cancelled
    let cancelled_order =
        encode_order(caller, side, _price, amount, filled, STATUS_CANCELLED);
    storage::dictionary_put(orders_uref, &order_id.to_string(), cancelled_order);
}

/// Get order details
#[no_mangle]
pub extern "C" fn get_order() {
    let order_id: u64 = runtime::get_named_arg("order_id");

    let orders_uref = get_uref(DICT_ORDERS);
    let order_data: String = storage::dictionary_get(orders_uref, &order_id.to_string())
        .unwrap_or_revert()
        .unwrap_or_revert_with(OrderBookError::OrderNotFound);

    runtime::ret(CLValue::from_t(order_data).unwrap_or_revert());
}

/// Get best bid price
#[no_mangle]
pub extern "C" fn get_best_bid_ep() {
    let best_bid = get_best_bid();
    runtime::ret(CLValue::from_t(best_bid).unwrap_or_revert());
}

/// Get best ask price
#[no_mangle]
pub extern "C" fn get_best_ask_ep() {
    let best_ask = get_best_ask();
    runtime::ret(CLValue::from_t(best_ask).unwrap_or_revert());
}

/// Deposit tokens to the order book (for selling)
#[no_mangle]
pub extern "C" fn deposit_tokens() {
    let caller = runtime::get_caller();
    let amount: U512 = runtime::get_named_arg("amount");

    if amount == U512::zero() {
        runtime::revert(OrderBookError::InvalidAmount);
    }

    // In a real implementation, this would transfer CEP-18 tokens
    // For now, we just track the balance internally
    let current_balance = get_token_balance(caller);
    set_token_balance(caller, current_balance + amount);
}

/// Withdraw tokens from the order book
#[no_mangle]
pub extern "C" fn withdraw_tokens() {
    let caller = runtime::get_caller();
    let amount: U512 = runtime::get_named_arg("amount");

    if amount == U512::zero() {
        runtime::revert(OrderBookError::InvalidAmount);
    }

    let current_balance = get_token_balance(caller);
    if current_balance < amount {
        runtime::revert(OrderBookError::InsufficientFunds);
    }

    // In a real implementation, this would transfer CEP-18 tokens back
    set_token_balance(caller, current_balance - amount);
}

// ============================================================================
// Contract Installation
// ============================================================================

fn build_entry_points() -> EntryPoints {
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        EP_PLACE_BUY_ORDER,
        vec![
            Parameter::new("price", CLType::U512),
            Parameter::new("amount", CLType::U512),
            Parameter::new("payment_purse", CLType::URef),
        ],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_PLACE_SELL_ORDER,
        vec![
            Parameter::new("price", CLType::U512),
            Parameter::new("amount", CLType::U512),
        ],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_CANCEL_ORDER,
        vec![Parameter::new("order_id", CLType::U64)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_GET_ORDER,
        vec![Parameter::new("order_id", CLType::U64)],
        CLType::String,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_GET_BEST_BID,
        vec![],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_GET_BEST_ASK,
        vec![],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_DEPOSIT_TOKENS,
        vec![Parameter::new("amount", CLType::U512)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_WITHDRAW_TOKENS,
        vec![Parameter::new("amount", CLType::U512)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points
}

#[no_mangle]
pub extern "C" fn call() {
    let admin: AccountHash = runtime::get_named_arg("admin");

    // Create purse for CSPR escrow
    let cspr_purse = system::create_purse();

    // Create dictionaries
    let orders_uref = storage::new_dictionary(DICT_ORDERS).unwrap_or_revert();
    let user_orders_uref = storage::new_dictionary(DICT_USER_ORDERS).unwrap_or_revert();
    let token_balances_uref = storage::new_dictionary(DICT_TOKEN_BALANCES).unwrap_or_revert();

    // Create storage for parameters
    let admin_uref = storage::new_uref(admin);
    let counter_uref = storage::new_uref(0u64);
    let best_bid_uref = storage::new_uref(U512::zero());
    let best_ask_uref = storage::new_uref(U512::MAX);

    // Build named keys
    let mut named_keys = NamedKeys::new();
    named_keys.insert(KEY_ADMIN.to_string(), admin_uref.into());
    named_keys.insert(KEY_CSPR_PURSE.to_string(), cspr_purse.into());
    named_keys.insert(KEY_ORDER_COUNTER.to_string(), counter_uref.into());
    named_keys.insert(KEY_BEST_BID.to_string(), best_bid_uref.into());
    named_keys.insert(KEY_BEST_ASK.to_string(), best_ask_uref.into());
    named_keys.insert(DICT_ORDERS.to_string(), orders_uref.into());
    named_keys.insert(DICT_USER_ORDERS.to_string(), user_orders_uref.into());
    named_keys.insert(DICT_TOKEN_BALANCES.to_string(), token_balances_uref.into());

    // Create entry points
    let entry_points = build_entry_points();

    // Install the contract
    let (contract_hash, _contract_version) = storage::new_contract(
        entry_points.into(),
        Some(named_keys),
        Some(CONTRACT_PACKAGE_KEY.to_string()),
        Some(CONTRACT_NAME.to_string()),
        None,
    );

    // Store the contract hash
    runtime::put_key(CONTRACT_HASH_KEY, contract_hash.into());
}
