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
  KeyAlgorithm,
  ModuleBytes,
  PrivateKey,
  PublicKey,
  Timestamp,
} from 'casper-js-sdk';

const NETWORK_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || 'casper-test';

// Load WASM
const wasmPath = join(process.cwd(), 'public', 'contracts', 'cep18.wasm');
const wasmBytes = new Uint8Array(readFileSync(wasmPath));
console.log("WASM size:", wasmBytes.length);

// Build args
const args = Args.fromMap({
  name: CLValue.newCLString("TestToken"),
  symbol: CLValue.newCLString("TEST"),
  decimals: CLValue.newCLUint8(9),
  total_supply: CLValue.newCLUInt256("1000000000000000"),
  events_mode: CLValue.newCLUint8(1),
  enable_mint_burn: CLValue.newCLUint8(0),
});

console.log("Args length:", args.toBytes().length);

// Load signer
const signerKey = PrivateKey.fromHex(process.env.CSPR_DEPLOYER_PRIVATE_KEY_HEX!, KeyAlgorithm.ED25519);
const signerPublicKey = signerKey.publicKey;
console.log("Signer public key:", signerPublicKey.toHex());

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

// Create deploy
const deploy = Deploy.makeDeploy(header, payment, session);

console.log("Deploy hash:", deploy.hash.toHex());
console.log("Deploy JSON:", JSON.stringify(Deploy.toJSON(deploy), null, 2).slice(0, 500));
