//! Minimal test contract
#![no_std]
#![no_main]

extern crate alloc;

use casper_contract::contract_api::runtime;
use casper_types::CLValue;

#[no_mangle]
pub extern "C" fn call() {
    // Do nothing - just return
    runtime::ret(CLValue::from_t(()).unwrap());
}
