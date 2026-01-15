const { CasperServiceByJsonRPC } = require("casper-js-sdk");
const dotenv = require('dotenv');
dotenv.config();

const RPC_URL = process.env.CSPR_RPC_URL_PRIMARY || "http://136.243.187.84:7777/rpc";
const DEPLOY_HASH = "7d550871f70454138933b6a0eac86070aa51a8dea390b534712121e26bb85b15";

async function check() {
  console.log(`Checking deploy ${DEPLOY_HASH} on ${RPC_URL}`);

  // SDK v2 export check
  const Service = CasperServiceByJsonRPC || CasperServiceByJsonRPC.CasperServiceByJsonRPC;
  const client = new Service(RPC_URL);

  try {
    const deployInfo = await client.getDeployInfo(DEPLOY_HASH);
    console.log("Deploy Info:", JSON.stringify(deployInfo, null, 2));

    // Check execution results
    if (deployInfo.execution_results.length > 0) {
      const result = deployInfo.execution_results[0].result;
      if (result.Success) {
        console.log("SUCCESS! Deploy executed successfully.");
      } else {
        console.log("FAILURE! Deploy failed execution.");
        console.log(JSON.stringify(result.Failure, null, 2));
      }
    } else {
      console.log("PENDING (or not found in execution results yet)");
    }

  } catch (e) {
    console.error("Error fetching deploy info:", e);
  }
}

check();
