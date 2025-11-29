//! Lock CSPR Session Contract
//!
//! This session code transfers CSPR from the caller's main purse to the Token Vault contract.
//! It creates a temporary purse, transfers the specified amount, then calls the vault's lock_cspr entry point.
//!
//! # Arguments
//! - `vault_contract_hash`: The contract hash of the Token Vault
//! - `order_id`: Unique identifier for the order
//! - `amount`: Amount of CSPR to lock (in motes)

#![no_std]
#![no_main]

#[cfg(not(target_arch = "wasm32"))]
compile_error!("target arch should be wasm32: compile with '--target wasm32-unknown-unknown'");

extern crate alloc;

use alloc::string::String;
use casper_contract::contract_api::{account, runtime, system};
use casper_types::{contracts::ContractHash, runtime_args, ApiError, RuntimeArgs, URef, U512};

#[no_mangle]
pub extern "C" fn call() {
    // Get arguments
    let vault_contract_hash: ContractHash = runtime::get_named_arg("vault_contract_hash");
    let order_id: String = runtime::get_named_arg("order_id");
    let amount: U512 = runtime::get_named_arg("amount");

    // Get caller's main purse
    let main_purse: URef = account::get_main_purse();

    // Create a temporary purse for the transfer
    let temp_purse: URef = system::create_purse();

    // Transfer from main purse to temp purse
    system::transfer_from_purse_to_purse(main_purse, temp_purse, amount, None)
        .unwrap_or_else(|_| runtime::revert(ApiError::User(1))); // Error code 1: Transfer failed

    // Call the vault contract's lock_cspr entry point
    let args = runtime_args! {
        "order_id" => order_id,
        "amount" => amount,
        "payment_purse" => temp_purse,
    };

    runtime::call_contract::<()>(vault_contract_hash, "lock_cspr", args);
}
