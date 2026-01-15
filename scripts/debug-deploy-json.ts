
import { DeployUtil, CLPublicKey, CLValueBuilder, RuntimeArgs } from "casper-js-sdk";

const run = () => {
    try {
        const accountKey = CLPublicKey.fromHex("0106ca7c39cd272dbf21a86eeb3b36b7c26e2e9b94af64292419f7862936bca2ca");
        const chainName = "casper-test";
        const payment = 100000000;

        const deploy = DeployUtil.makeDeploy(
            new DeployUtil.DeployParams(
                accountKey,
                chainName,
                1,
                1800000
            ),
            DeployUtil.ExecutableDeployItem.newTransfer(
                1000,
                accountKey,
                undefined,
                123
            ),
            DeployUtil.standardPayment(payment)
        );

        const json = DeployUtil.deployToJson(deploy);
        console.log("Deploy JSON keys:", Object.keys(json));
        if (json.header) {
            console.log("Header keys:", Object.keys(json.header));
            console.log("Header:", JSON.stringify(json.header, null, 2));
        } else {
            console.log("Header is MISSING");
        }

        // Check where account is
        // SDK v2 might use snake_case or have different name
        console.log("Full JSON:", JSON.stringify(json, null, 2));

    } catch (e) {
        console.error(e);
    }
};

run();
