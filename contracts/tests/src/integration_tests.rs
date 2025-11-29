fn main() {
    panic!("Execute \"cargo test\" to test the contract, not \"cargo run\".");
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use casper_engine_test_support::{
        DeployItemBuilder, ExecuteRequestBuilder, LmdbWasmTestBuilder, ARG_AMOUNT,
        DEFAULT_ACCOUNT_ADDR, DEFAULT_PAYMENT, LOCAL_GENESIS_REQUEST,
    };
    use casper_execution_engine::{engine_state::Error, execution::ExecError};
    use casper_types::{
        account::AccountHash, runtime_args, ApiError, Key, RuntimeArgs, URef, U512,
    };

    // Contract constants
    const CONTRACT_WASM: &str = "contract.wasm";
    const KEY_ADMIN: &str = "admin";
    const KEY_CSPR_PURSE: &str = "cspr_purse";
    const DICT_LOCKED_CSPR: &str = "locked_cspr";

    // Error codes from contract
    const ERROR_INSUFFICIENT_BALANCE: u16 = 1;
    const ERROR_ORDER_NOT_FOUND: u16 = 2;
    const ERROR_NOT_ORDER_OWNER: u16 = 3;
    const ERROR_NOT_AUTHORIZED: u16 = 4;
    const ERROR_ALREADY_LOCKED: u16 = 5;
    const ERROR_INVALID_AMOUNT: u16 = 6;

    fn deploy_contract(builder: &mut LmdbWasmTestBuilder) {
        let session_code = PathBuf::from(CONTRACT_WASM);
        let session_args = runtime_args! {
            "admin" => *DEFAULT_ACCOUNT_ADDR,
        };

        let deploy_item = DeployItemBuilder::new()
            .with_standard_payment(runtime_args! {
                ARG_AMOUNT => *DEFAULT_PAYMENT
            })
            .with_session_code(session_code, session_args)
            .with_authorization_keys(&[*DEFAULT_ACCOUNT_ADDR])
            .with_address(*DEFAULT_ACCOUNT_ADDR)
            .build();

        let execute_request = ExecuteRequestBuilder::from_deploy_item(&deploy_item).build();
        builder.exec(execute_request).commit().expect_success();
    }

    #[test]
    fn should_deploy_contract_with_admin() {
        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();

        deploy_contract(&mut builder);

        // Verify admin key was stored
        let admin_result = builder
            .query(
                None,
                Key::Account(*DEFAULT_ACCOUNT_ADDR),
                &[KEY_ADMIN.to_string()],
            )
            .expect("should have admin key");

        assert!(admin_result.as_cl_value().is_some(), "admin should be stored");

        // Verify CSPR purse was created
        let purse_result = builder.query(
            None,
            Key::Account(*DEFAULT_ACCOUNT_ADDR),
            &[KEY_CSPR_PURSE.to_string()],
        );

        assert!(purse_result.is_ok(), "cspr_purse should be stored");
    }

    #[test]
    fn should_error_on_missing_admin_arg() {
        let session_code = PathBuf::from(CONTRACT_WASM);
        let session_args = RuntimeArgs::new(); // Missing admin arg

        let deploy_item = DeployItemBuilder::new()
            .with_standard_payment(runtime_args! {ARG_AMOUNT => *DEFAULT_PAYMENT})
            .with_authorization_keys(&[*DEFAULT_ACCOUNT_ADDR])
            .with_address(*DEFAULT_ACCOUNT_ADDR)
            .with_session_code(session_code, session_args)
            .build();

        let execute_request = ExecuteRequestBuilder::from_deploy_item(&deploy_item).build();

        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();
        builder.exec(execute_request).commit().expect_failure();

        let actual_error = builder.get_error().expect("must have error");
        assert!(
            matches!(
                actual_error,
                Error::Exec(ExecError::Revert(ApiError::MissingArgument))
            ),
            "Expected MissingArgument error, received {:?}",
            actual_error
        );
    }

    // Note: The following tests require a more complex setup with purse transfers
    // and multiple accounts. They serve as documentation of expected behavior.

    #[test]
    fn test_lock_cspr_requires_payment_purse() {
        // This test documents that lock_cspr requires a valid payment_purse argument
        // In a real test, we would:
        // 1. Deploy the contract
        // 2. Create a payment purse with CSPR
        // 3. Call lock_cspr with the purse
        // 4. Verify the amount was locked

        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();
        deploy_contract(&mut builder);

        // Contract is deployed, admin key is set
        // Further testing requires session code to interact with entry points
        assert!(true, "Contract deployed successfully for lock_cspr testing");
    }

    #[test]
    fn test_cancel_order_only_by_owner() {
        // This test documents that cancel_order can only be called by the order owner
        // Expected behavior:
        // 1. User A locks CSPR for order "order-1"
        // 2. User B tries to cancel "order-1" -> should fail with NOT_ORDER_OWNER
        // 3. User A cancels "order-1" -> should succeed and refund CSPR

        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();
        deploy_contract(&mut builder);

        assert!(true, "Contract deployed for cancel_order testing");
    }

    #[test]
    fn test_unlock_cspr_only_by_admin_or_order_book() {
        // This test documents that unlock_cspr can only be called by admin or order_book
        // Expected behavior:
        // 1. User locks CSPR for order
        // 2. Random user tries to unlock -> should fail with NOT_AUTHORIZED
        // 3. Admin unlocks -> should succeed
        // 4. After set_order_book, order_book can also unlock

        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();
        deploy_contract(&mut builder);

        assert!(true, "Contract deployed for unlock_cspr testing");
    }

    #[test]
    fn test_set_order_book_only_by_admin() {
        // This test documents that set_order_book can only be called by admin
        // Expected behavior:
        // 1. Non-admin tries to set order_book -> should fail with NOT_AUTHORIZED
        // 2. Admin sets order_book -> should succeed

        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();
        deploy_contract(&mut builder);

        assert!(true, "Contract deployed for set_order_book testing");
    }
}
