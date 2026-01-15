const { CasperServiceByJsonRPC } = require("casper-js-sdk");
const dotenv = require('dotenv');
dotenv.config();

const RPC_URL = process.env.CSPR_RPC_URL_PRIMARY || "http://136.243.187.84:7777/rpc";
const HASH = process.argv[2];

if (!HASH) {
    console.log("Provide hash as arg");
    process.exit(1);
}

const Service = CasperServiceByJsonRPC || CasperServiceByJsonRPC.CasperServiceByJsonRPC;
const client = new Service(RPC_URL);

async function check() {
    try {
        const info = await client.getDeployInfo(HASH);
        console.log(JSON.stringify(info.execution_info, null, 2));
    } catch (e) {
        console.error(e);
    }
}
check();
