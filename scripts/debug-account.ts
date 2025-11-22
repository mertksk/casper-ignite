import { RpcClient, HttpHandler, PublicKey } from 'casper-js-sdk';
import * as dotenv from 'dotenv';
dotenv.config();

const RPC_URL = process.env.CSPR_RPC_URL_PRIMARY || 'http://136.243.187.84:7777/rpc';

async function check() {
  console.log('Using RPC:', RPC_URL);
  
  const client = new RpcClient(new HttpHandler(RPC_URL, "fetch"));
  
  try {
    // 1. Check Status / Chain Name
    const status = await client.getStatus();
    console.log('Node Chain Name:', status.chainSpecName);
    console.log('Node Version:', status.apiVersion);
    
    // 2. Check Account
    const deployerPem = process.env.CSPR_DEPLOYER_PRIVATE_KEY_PEM;
    const publicKeyHex = process.env.CSPR_DEPLOYER_PUBLIC_KEY;
    
    if (!publicKeyHex) {
        console.log('No CSPR_DEPLOYER_PUBLIC_KEY in .env');
        return;
    }

    const pk = PublicKey.fromHex(publicKeyHex);
    const accountHash = pk.accountHash().toHex();
    console.log('Deployer Public Key:', publicKeyHex);
    console.log('Deployer Account Hash:', accountHash);
    
    // 3. Check Balance
    const stateRootResult = await client.getStateRootHashLatest();
    const stateRoot = stateRootResult.toString(); // Ensure string
    console.log('State Root:', stateRoot);
    
    const key = `account-hash-${accountHash}`;
    console.log('Querying Key:', key);
    
    try {
        const result = await client.queryGlobalStateByStateHash(stateRoot, key, []);
        //console.log('Account Query Result:', JSON.stringify(result, null, 2).slice(0, 200) + '...');
        
        // Try simpler way too
        const balance = await client.queryLatestGlobalState(key, []);
        console.log('QueryLatestGlobalState Result:', !!balance);

    } catch (e: any) {
        console.error('Account Query Failed:', e.message);
        console.log('-> This suggests the account is NOT funded/indexed on this node.');
    }
    
  } catch (e: any) {
    console.error('Global Error:', e.message);
  }
}

check();
