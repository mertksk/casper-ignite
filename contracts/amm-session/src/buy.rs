//! AMM Buy Session
//! Buys tokens from the AMM by sending CSPR

#![no_std]
#![no_main]

#[cfg(not(target_arch = "wasm32"))]
compile_error!("target arch should be wasm32: compile with '--target wasm32-unknown-unknown'");

extern crate alloc;

use casper_contract::contract_api::{account, runtime, system};
use casper_types::{contracts::ContractHash, runtime_args, ApiError, RuntimeArgs, U512};

#[no_mangle]
pub extern "C" fn call() {
    let amm_contract_hash: ContractHash = runtime::get_named_arg("amm_contract_hash");
    let token_amount: U512 = runtime::get_named_arg("token_amount");
    let max_cost: U512 = runtime::get_named_arg("max_cost");

    // Get caller's main purse
    let main_purse = account::get_main_purse();

    // Create temp purse and transfer max_cost
    let temp_purse = system::create_purse();
    system::transfer_from_purse_to_purse(main_purse, temp_purse, max_cost, None)
        .unwrap_or_else(|_| runtime::revert(ApiError::User(1)));

    // Call buy on AMM
    let args = runtime_args! {
        "token_amount" => token_amount,
        "max_cost" => max_cost,
        "payment_purse" => temp_purse,
    };

    runtime::call_contract::<()>(amm_contract_hash, "buy", args);

    // Any leftover CSPR in temp_purse should be returned
    // (The AMM only takes what it needs based on actual cost)
    let remaining = system::get_purse_balance(temp_purse).unwrap_or_default();
    if remaining > U512::zero() {
        system::transfer_from_purse_to_purse(temp_purse, main_purse, remaining, None)
            .unwrap_or_else(|_| runtime::revert(ApiError::User(2)));
    }
}
