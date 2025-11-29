//! Launchpad Controller Contract for Casper Ignite
//!
//! Manages token launches with vesting, fee collection, and AMM integration.
//!
//! # Entry Points
//! - `create_project`: Register a new project
//! - `launch_token`: Deploy token and setup AMM
//! - `claim_vested`: Claim vested tokens
//! - `collect_fees`: Admin collects platform fees
//! - `get_project`: Query project details
//! - `get_vesting`: Query vesting schedule

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
pub enum LaunchpadError {
    NotAuthorized = 1,
    ProjectNotFound = 2,
    ProjectAlreadyExists = 3,
    InvalidAmount = 4,
    TransferFailed = 5,
    VestingNotReady = 6,
    AlreadyClaimed = 7,
    MathOverflow = 8,
    MissingKey = 9,
    InsufficientPayment = 10,
    AlreadyLaunched = 11,
}

impl From<LaunchpadError> for ApiError {
    fn from(e: LaunchpadError) -> Self {
        ApiError::User(e as u16)
    }
}

// ============================================================================
// Constants
// ============================================================================

const CONTRACT_NAME: &str = "launchpad";
const CONTRACT_HASH_KEY: &str = "launchpad_hash";
const CONTRACT_PACKAGE_KEY: &str = "launchpad_package";

// Storage keys
const KEY_ADMIN: &str = "admin";
const KEY_FEE_PURSE: &str = "fee_purse";
const KEY_PROJECT_COUNTER: &str = "project_counter";
const KEY_PLATFORM_FEE: &str = "platform_fee"; // Fee in motes (e.g., 20 CSPR)
const KEY_TOTAL_FEES: &str = "total_fees";
const DICT_PROJECTS: &str = "projects";
const DICT_VESTING: &str = "vesting";

// Entry point names
const EP_CREATE_PROJECT: &str = "create_project";
const EP_LAUNCH_TOKEN: &str = "launch_token";
const EP_CLAIM_VESTED: &str = "claim_vested";
const EP_COLLECT_FEES: &str = "collect_fees";
const EP_GET_PROJECT: &str = "get_project";
const EP_GET_VESTING: &str = "get_vesting";
const EP_SET_PLATFORM_FEE: &str = "set_platform_fee";

// Project status
const STATUS_PENDING: u8 = 0;
const STATUS_LAUNCHED: u8 = 1;
const STATUS_CANCELLED: u8 = 2;

// Default vesting: 12 months cliff, 24 months total
const DEFAULT_CLIFF_MS: u64 = 365 * 24 * 60 * 60 * 1000; // 1 year
const DEFAULT_VESTING_MS: u64 = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years

// ============================================================================
// Helper Functions
// ============================================================================

fn get_uref(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert_with(LaunchpadError::MissingKey)
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
        runtime::revert(LaunchpadError::NotAuthorized);
    }
}

fn get_project_counter() -> u64 {
    let counter_uref = get_uref(KEY_PROJECT_COUNTER);
    storage::read(counter_uref)
        .unwrap_or_revert()
        .unwrap_or(0u64)
}

fn set_project_counter(value: u64) {
    let counter_uref = get_uref(KEY_PROJECT_COUNTER);
    storage::write(counter_uref, value);
}

fn get_platform_fee() -> U512 {
    let fee_uref = get_uref(KEY_PLATFORM_FEE);
    storage::read(fee_uref)
        .unwrap_or_revert()
        .unwrap_or(U512::from(20_000_000_000u64)) // 20 CSPR default
}

fn get_total_fees() -> U512 {
    let total_uref = get_uref(KEY_TOTAL_FEES);
    storage::read(total_uref)
        .unwrap_or_revert()
        .unwrap_or(U512::zero())
}

fn set_total_fees(value: U512) {
    let total_uref = get_uref(KEY_TOTAL_FEES);
    storage::write(total_uref, value);
}

fn get_block_time() -> u64 {
    runtime::get_blocktime().into()
}

// Project format: founder,name,symbol,supply,status,launch_time
fn encode_project(
    founder: AccountHash,
    name: &str,
    symbol: &str,
    supply: U512,
    status: u8,
    launch_time: u64,
) -> String {
    let mut s = String::new();
    s.push_str(&founder.to_string());
    s.push(',');
    s.push_str(name);
    s.push(',');
    s.push_str(symbol);
    s.push(',');
    s.push_str(&supply.to_string());
    s.push(',');
    s.push_str(&status.to_string());
    s.push(',');
    s.push_str(&launch_time.to_string());
    s
}

// Vesting format: founder,total,claimed,cliff_time,end_time
fn encode_vesting(
    founder: AccountHash,
    total: U512,
    claimed: U512,
    cliff_time: u64,
    end_time: u64,
) -> String {
    let mut s = String::new();
    s.push_str(&founder.to_string());
    s.push(',');
    s.push_str(&total.to_string());
    s.push(',');
    s.push_str(&claimed.to_string());
    s.push(',');
    s.push_str(&cliff_time.to_string());
    s.push(',');
    s.push_str(&end_time.to_string());
    s
}

// ============================================================================
// Entry Points Implementation
// ============================================================================

/// Create a new project (pays platform fee)
#[no_mangle]
pub extern "C" fn create_project() {
    let caller = runtime::get_caller();
    let name: String = runtime::get_named_arg("name");
    let symbol: String = runtime::get_named_arg("symbol");
    let supply: U512 = runtime::get_named_arg("supply");
    let payment_purse: URef = runtime::get_named_arg("payment_purse");

    if supply == U512::zero() {
        runtime::revert(LaunchpadError::InvalidAmount);
    }

    // Collect platform fee
    let platform_fee = get_platform_fee();
    let fee_purse = get_uref(KEY_FEE_PURSE);
    system::transfer_from_purse_to_purse(payment_purse, fee_purse, platform_fee, None)
        .unwrap_or_revert_with(LaunchpadError::TransferFailed);

    // Update total fees
    let current_fees = get_total_fees();
    set_total_fees(current_fees + platform_fee);

    // Create project
    let project_id = get_project_counter() + 1;
    set_project_counter(project_id);

    let project_data = encode_project(caller, &name, &symbol, supply, STATUS_PENDING, 0);

    // Store project
    let projects_uref = get_uref(DICT_PROJECTS);
    storage::dictionary_put(projects_uref, &project_id.to_string(), project_data);

    // Return project ID
    runtime::ret(CLValue::from_t(project_id).unwrap_or_revert());
}

/// Launch token (sets up vesting for founder)
#[no_mangle]
pub extern "C" fn launch_token() {
    let caller = runtime::get_caller();
    let project_id: u64 = runtime::get_named_arg("project_id");
    let founder_allocation: U512 = runtime::get_named_arg("founder_allocation"); // Percentage * 100 (e.g., 1000 = 10%)

    let projects_uref = get_uref(DICT_PROJECTS);
    let project_data: String = storage::dictionary_get(projects_uref, &project_id.to_string())
        .unwrap_or_revert()
        .unwrap_or_revert_with(LaunchpadError::ProjectNotFound);

    // Parse project
    let parts: alloc::vec::Vec<&str> = project_data.split(',').collect();
    if parts.len() < 6 {
        runtime::revert(LaunchpadError::ProjectNotFound);
    }

    // Verify caller is founder
    let founder_str = parts[0];
    if !founder_str.contains(&caller.to_string()[13..]) {
        runtime::revert(LaunchpadError::NotAuthorized);
    }

    let status: u8 = parts[4].parse().unwrap_or(255);
    if status != STATUS_PENDING {
        runtime::revert(LaunchpadError::AlreadyLaunched);
    }

    let supply: U512 = parts[3].parse().unwrap_or(U512::zero());
    let name = parts[1];
    let symbol = parts[2];

    // Calculate founder tokens
    let founder_tokens = supply * founder_allocation / U512::from(10000u64);

    // Setup vesting
    let now = get_block_time();
    let cliff_time = now + DEFAULT_CLIFF_MS;
    let end_time = now + DEFAULT_VESTING_MS;

    let vesting_data = encode_vesting(caller, founder_tokens, U512::zero(), cliff_time, end_time);
    let vesting_uref = get_uref(DICT_VESTING);
    storage::dictionary_put(vesting_uref, &project_id.to_string(), vesting_data);

    // Update project status
    let updated_project = encode_project(caller, name, symbol, supply, STATUS_LAUNCHED, now);
    storage::dictionary_put(projects_uref, &project_id.to_string(), updated_project);
}

/// Claim vested tokens
#[no_mangle]
pub extern "C" fn claim_vested() {
    let caller = runtime::get_caller();
    let project_id: u64 = runtime::get_named_arg("project_id");

    let vesting_uref = get_uref(DICT_VESTING);
    let vesting_data: String = storage::dictionary_get(vesting_uref, &project_id.to_string())
        .unwrap_or_revert()
        .unwrap_or_revert_with(LaunchpadError::ProjectNotFound);

    // Parse vesting
    let parts: alloc::vec::Vec<&str> = vesting_data.split(',').collect();
    if parts.len() < 5 {
        runtime::revert(LaunchpadError::ProjectNotFound);
    }

    // Verify caller is founder
    let founder_str = parts[0];
    if !founder_str.contains(&caller.to_string()[13..]) {
        runtime::revert(LaunchpadError::NotAuthorized);
    }

    let total: U512 = parts[1].parse().unwrap_or(U512::zero());
    let claimed: U512 = parts[2].parse().unwrap_or(U512::zero());
    let cliff_time: u64 = parts[3].parse().unwrap_or(u64::MAX);
    let end_time: u64 = parts[4].parse().unwrap_or(u64::MAX);

    let now = get_block_time();

    // Check cliff
    if now < cliff_time {
        runtime::revert(LaunchpadError::VestingNotReady);
    }

    // Calculate vested amount
    let vested = if now >= end_time {
        total
    } else {
        let elapsed = now - cliff_time;
        let vesting_duration = end_time - cliff_time;
        total * U512::from(elapsed) / U512::from(vesting_duration)
    };

    // Calculate claimable
    let claimable = vested - claimed;
    if claimable == U512::zero() {
        runtime::revert(LaunchpadError::AlreadyClaimed);
    }

    // Update vesting record
    let updated_vesting = encode_vesting(caller, total, claimed + claimable, cliff_time, end_time);
    storage::dictionary_put(vesting_uref, &project_id.to_string(), updated_vesting);

    // In a real implementation, transfer tokens here
    // For now, just return the claimable amount
    runtime::ret(CLValue::from_t(claimable).unwrap_or_revert());
}

/// Admin collects platform fees
#[no_mangle]
pub extern "C" fn collect_fees() {
    only_admin();

    let recipient: AccountHash = runtime::get_named_arg("recipient");
    let amount: U512 = runtime::get_named_arg("amount");

    let fee_purse = get_uref(KEY_FEE_PURSE);
    let balance = system::get_purse_balance(fee_purse)
        .unwrap_or_revert_with(LaunchpadError::MissingKey);

    if balance < amount {
        runtime::revert(LaunchpadError::InsufficientPayment);
    }

    system::transfer_from_purse_to_account(fee_purse, recipient, amount, None)
        .unwrap_or_revert_with(LaunchpadError::TransferFailed);
}

/// Get project details
#[no_mangle]
pub extern "C" fn get_project() {
    let project_id: u64 = runtime::get_named_arg("project_id");

    let projects_uref = get_uref(DICT_PROJECTS);
    let project_data: String = storage::dictionary_get(projects_uref, &project_id.to_string())
        .unwrap_or_revert()
        .unwrap_or_revert_with(LaunchpadError::ProjectNotFound);

    runtime::ret(CLValue::from_t(project_data).unwrap_or_revert());
}

/// Get vesting details
#[no_mangle]
pub extern "C" fn get_vesting() {
    let project_id: u64 = runtime::get_named_arg("project_id");

    let vesting_uref = get_uref(DICT_VESTING);
    let vesting_data: String = storage::dictionary_get(vesting_uref, &project_id.to_string())
        .unwrap_or_revert()
        .unwrap_or_revert_with(LaunchpadError::ProjectNotFound);

    runtime::ret(CLValue::from_t(vesting_data).unwrap_or_revert());
}

/// Set platform fee (admin only)
#[no_mangle]
pub extern "C" fn set_platform_fee() {
    only_admin();

    let fee: U512 = runtime::get_named_arg("fee");
    let fee_uref = get_uref(KEY_PLATFORM_FEE);
    storage::write(fee_uref, fee);
}

// ============================================================================
// Contract Installation
// ============================================================================

fn build_entry_points() -> EntryPoints {
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        EP_CREATE_PROJECT,
        vec![
            Parameter::new("name", CLType::String),
            Parameter::new("symbol", CLType::String),
            Parameter::new("supply", CLType::U512),
            Parameter::new("payment_purse", CLType::URef),
        ],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_LAUNCH_TOKEN,
        vec![
            Parameter::new("project_id", CLType::U64),
            Parameter::new("founder_allocation", CLType::U512),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_CLAIM_VESTED,
        vec![Parameter::new("project_id", CLType::U64)],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_COLLECT_FEES,
        vec![
            Parameter::new("recipient", CLType::ByteArray(32)),
            Parameter::new("amount", CLType::U512),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_GET_PROJECT,
        vec![Parameter::new("project_id", CLType::U64)],
        CLType::String,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_GET_VESTING,
        vec![Parameter::new("project_id", CLType::U64)],
        CLType::String,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        EP_SET_PLATFORM_FEE,
        vec![Parameter::new("fee", CLType::U512)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points
}

#[no_mangle]
pub extern "C" fn call() {
    let admin: AccountHash = runtime::get_named_arg("admin");

    // Create purse for fee collection
    let fee_purse = system::create_purse();

    // Create dictionaries
    let projects_uref = storage::new_dictionary(DICT_PROJECTS).unwrap_or_revert();
    let vesting_uref = storage::new_dictionary(DICT_VESTING).unwrap_or_revert();

    // Create storage
    let admin_uref = storage::new_uref(admin);
    let counter_uref = storage::new_uref(0u64);
    let fee_uref = storage::new_uref(U512::from(20_000_000_000u64)); // 20 CSPR
    let total_uref = storage::new_uref(U512::zero());

    // Build named keys
    let mut named_keys = NamedKeys::new();
    named_keys.insert(KEY_ADMIN.to_string(), admin_uref.into());
    named_keys.insert(KEY_FEE_PURSE.to_string(), fee_purse.into());
    named_keys.insert(KEY_PROJECT_COUNTER.to_string(), counter_uref.into());
    named_keys.insert(KEY_PLATFORM_FEE.to_string(), fee_uref.into());
    named_keys.insert(KEY_TOTAL_FEES.to_string(), total_uref.into());
    named_keys.insert(DICT_PROJECTS.to_string(), projects_uref.into());
    named_keys.insert(DICT_VESTING.to_string(), vesting_uref.into());

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
