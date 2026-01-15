const { CasperServiceByJsonRPC, CLPublicKey } = require('casper-js-sdk');
const dotenv = require('dotenv');
dotenv.config();

// Helper for SDK v2 export
const Service = CasperServiceByJsonRPC || CasperServiceByJsonRPC.CasperServiceByJsonRPC;
const RPC_URL = process.env.CSPR_RPC_URL_PRIMARY || "http://136.243.187.84:7777/rpc";
const CLIENT_ADDRESS = process.env.PLATFORM_TOKEN_WALLET_ADDRESS || "01252f367c8cfe14bf796a6ad298d9ad7a8d2eb22907e047b37e6bbb76d7b636b2";

async function main() {
    const client = new Service(RPC_URL);
    try {
        const balance = await client.queryBalance("main_purse_under_public_key", CLPublicKey.fromHex(CLIENT_ADDRESS));
        console.log(`Address: ${CLIENT_ADDRESS}`);
        console.log(`Balance: ${balance.toString()} motes`);
        console.log(`Balance: ${balance / 1000000000n} CSPR`);
    } catch (e) {
        console.error("Error fetching balance:", e);
    }
}

main();
