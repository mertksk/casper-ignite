
import 'dotenv/config';

async function rpc(method: string, params: any) {
    const res = await fetch('https://node.testnet.casper.network/rpc', {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        headers: { 'Content-Type': 'application/json' }
    });
    const json = await res.json();
    if (json.error) throw new Error(JSON.stringify(json.error));
    return json.result;
}

async function main() {
    const deployHash = '973e5dc3b7aa340838e395c130743a199f1ef11c1dfa831268be635809af8859';

    console.log(`Fetching Deploy ${deployHash}...`);
    const deployRes = await rpc('info_get_deploy', { deploy_hash: deployHash });
    const deployHeader = deployRes.deploy.header;

    console.log("Deploy Header:", JSON.stringify(deployHeader, null, 2));

    const account = deployHeader.account;
    const deployTimestamp = deployHeader.timestamp;
    console.log(`Deployer: ${account}`);

    console.log("Fetching Account Info...");
    try {
        // Try state_get_account_info
        const accountRes = await rpc('state_get_account_info', { public_key: account });
        const accountInfo = accountRes.account;
        console.log("Account Info:", JSON.stringify(accountInfo, null, 2));
    } catch (e) {
        console.error("Failed to get account info:", e);
    }
}

main().catch(console.error);
