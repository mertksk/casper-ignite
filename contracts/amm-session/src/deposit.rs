//! AMM Deposit Reserve Session
//! Deposits CSPR into the AMM reserve (admin only)

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
    let amount: U512 = runtime::get_named_arg("amount");

    // Get caller's main purse
    let main_purse = account::get_main_purse();

    // Create temp purse and transfer
    let temp_purse = system::create_purse();
    system::transfer_from_purse_to_purse(main_purse, temp_purse, amount, None)
        .unwrap_or_else(|_| runtime::revert(ApiError::User(1)));

    // Call deposit_reserve on AMM
    let args = runtime_args! {
        "payment_purse" => temp_purse,
        "amount" => amount,
    };

    runtime::call_contract::<()>(amm_contract_hash, "deposit_reserve", args);
}
