const { CasperServiceByJsonRPC, CLValueBuilder, RuntimeArgs, DeployUtil, Keys, CLU8Type, CLBoolType } = require("casper-js-sdk");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const RPC_URL = process.env.CSPR_RPC_URL_PRIMARY || "http://136.243.187.84:7777/rpc";
const NETWORK_NAME = "casper-test";

const loadServerSigner = () => {
    const hex = process.env.CSPR_DEPLOYER_PRIVATE_KEY_HEX;
    if (!hex) return null;
    const secret = Uint8Array.from(Buffer.from(hex, 'hex'));
    return Keys.Ed25519.parseKeyPair(Keys.Ed25519.privateToPublicKey(secret), secret);
};

const wasmPath = path.join(process.cwd(), "public", "contracts", "cep18.wasm");
const wasm = new Uint8Array(fs.readFileSync(wasmPath));

async function main() {
    const deployerKey = loadServerSigner();
    if (!deployerKey) {
        console.error("No deployer key");
        return;
    }

    const client = new CasperServiceByJsonRPC(RPC_URL);

    // CEP-18 v2.0.0 - Only required arguments (optional args default to 0)
    const args = RuntimeArgs.fromMap({
        name: CLValueBuilder.string("TestMini"),
        symbol: CLValueBuilder.string("MINI"),
        decimals: CLValueBuilder.u8(9),
        total_supply: CLValueBuilder.u256("1000000000000")
    });

    const deploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(deployerKey.publicKey, NETWORK_NAME, 1, 1800000),
        DeployUtil.ExecutableDeployItem.newModuleBytes(wasm, args),
        DeployUtil.standardPayment(350000000000)
    );

    const signed = DeployUtil.signDeploy(deploy, deployerKey);
    const deployHash = await client.deploy(signed);

    // SDK v2 might return object
    const hash = typeof deployHash === 'string' ? deployHash : deployHash.deploy_hash;
    console.log(`Deployed Test Token: ${hash}`);
}

main();
