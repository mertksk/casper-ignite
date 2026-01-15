import 'dotenv/config';
import { Args, CLValue } from 'casper-js-sdk';

// Test argument serialization for CEP-18
const nameValue = CLValue.newCLString("TestToken");
const symbolValue = CLValue.newCLString("TEST");
const decimalsValue = CLValue.newCLUint8(9);
const totalSupplyValue = CLValue.newCLUInt256("1000000000000000");
const eventsModeValue = CLValue.newCLUint8(1);
const enableMintBurnValue = CLValue.newCLUint8(0);

const args = Args.fromMap({
  name: nameValue,
  symbol: symbolValue,
  decimals: decimalsValue,
  total_supply: totalSupplyValue,
  events_mode: eventsModeValue,
  enable_mint_burn: enableMintBurnValue,
});

console.log("Args bytes (hex):", Buffer.from(args.toBytes()).toString("hex"));
console.log("Args length:", args.toBytes().length);

// Also test individual CLValue bytes
console.log("\nIndividual CLValues:");
console.log("name bytes:", Buffer.from(nameValue.bytes()).toString("hex"));
console.log("symbol bytes:", Buffer.from(symbolValue.bytes()).toString("hex"));
console.log("decimals bytes:", Buffer.from(decimalsValue.bytes()).toString("hex"));
console.log("total_supply bytes:", Buffer.from(totalSupplyValue.bytes()).toString("hex"));
