
const { DeployUtil, CLValueBuilder, RuntimeArgs, CLPublicKey } = require("casper-js-sdk");

const run = () => {
    const name = "TestToken";
    const symbol = "TEST";
    const decimals = 9;
    const supply = "1000000000";

    // Scenario 1: With Snake Case defaults
    const args1 = RuntimeArgs.fromMap({
        name: CLValueBuilder.string(name),
        symbol: CLValueBuilder.string(symbol),
        decimals: CLValueBuilder.u8(decimals),
        total_supply: CLValueBuilder.u256(supply),
        events_mode: CLValueBuilder.u8(1),
        enable_mint_burn: CLValueBuilder.u8(0)
    });

    console.log("Args 1 (Snake + Extras):");
    console.log(JSON.stringify(DeployUtil.deployToJson(makeDummyDeploy(args1)), null, 2));

    // Scenario 2: Minimal
    const args2 = RuntimeArgs.fromMap({
        name: CLValueBuilder.string(name),
        symbol: CLValueBuilder.string(symbol),
        decimals: CLValueBuilder.u8(decimals),
        total_supply: CLValueBuilder.u256(supply)
    });

    console.log("Args 2 (Minimal):");
    console.log(JSON.stringify(DeployUtil.deployToJson(makeDummyDeploy(args2)), null, 2));
};

function makeDummyDeploy(args) {
    const key = CLPublicKey.fromHex("01252f367c8cfe14bf796a6ad298d9ad7a8d2eb22907e047b37e6bbb76d7b636b2");
    return DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(key, "casper-test"),
        DeployUtil.ExecutableDeployItem.newModuleBytes(new Uint8Array([1, 2, 3]), args),
        DeployUtil.standardPayment(1000)
    );
}

run();
