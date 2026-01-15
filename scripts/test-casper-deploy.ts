import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  Args,
  CLValue,
  Deploy,
  DeployHeader,
  Duration,
  ExecutableDeployItem,
  HttpHandler,
  KeyAlgorithm,
  ModuleBytes,
  NamedArg,
  PrivateKey,
  PublicKey,
  RpcClient,
  Timestamp,
} from 'casper-js-sdk';

const NETWORK_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || 'casper-test';
const RPC_URL = 'https://node.testnet.casper.network/rpc';

async function main() {
  // Load WASM
  const wasmPath = join(process.cwd(), 'public', 'contracts', 'cep18.wasm');
  const wasmBytes = new Uint8Array(readFileSync(wasmPath));
  console.log("WASM size:", wasmBytes.length);

  // Build args using NamedArg array (alternative method)
  const namedArgs = [
    new NamedArg("name", CLValue.newCLString("GeminiV2")),
    new NamedArg("symbol", CLValue.newCLString("GV2")),
    new NamedArg("decimals", CLValue.newCLUint8(9)),
    new NamedArg("total_supply", CLValue.newCLUInt256("1000000000000000")),
  ];

  const args = Args.fromNamedArgs(namedArgs);
  console.log("Args length (NamedArgs method):", args.toBytes().length);

  // Load signer
  const signerKey = PrivateKey.fromHex(process.env.CSPR_DEPLOYER_PRIVATE_KEY_HEX!, KeyAlgorithm.ED25519);
  const signerPublicKey = signerKey.publicKey;

  // Build session
  const session = new ExecutableDeployItem();
  session.moduleBytes = new ModuleBytes(wasmBytes, args);

  // Build payment
  const payment = ExecutableDeployItem.standardPayment("250000000000");

  // Build header
  const header = new DeployHeader(
    NETWORK_NAME,
    [],
    1,
    new Timestamp(new Date(Date.now() - 20000)),
    new Duration(30 * 60 * 1000),
    signerPublicKey
  );

  // Create and sign deploy
  const deploy = Deploy.makeDeploy(header, payment, session);
  deploy.sign(signerKey);

  console.log("Deploy hash:", deploy.hash.toHex());
  console.log("Signer:", signerPublicKey.toHex());
  console.log("Approvals:", deploy.approvals.length);

  // Submit deploy
  const client = new RpcClient(new HttpHandler(RPC_URL, "fetch"));
  try {
    await client.putDeploy(deploy);
    console.log("Deploy submitted successfully!");
    console.log("View on Explorer: https://testnet.cspr.live/deploy/" + deploy.hash.toHex());
  } catch (error) {
    console.error("Deploy failed:", error);
  }
}

main();
