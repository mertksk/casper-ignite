/**
 * Test script to manually deploy a CEP-18 token and debug any issues.
 * Run with: npx ts-node scripts/test-deploy.ts
 */
import 'dotenv/config';
import { deployProjectToken } from '../src/lib/casper';

async function main() {
    console.log('Starting test token deployment...');
    console.log('Deployer Public Key:', process.env.CSPR_DEPLOYER_PUBLIC_KEY);
    console.log('Chain Name:', process.env.NEXT_PUBLIC_CHAIN_NAME);

    try {
        const result = await deployProjectToken({
            projectName: 'TestToken',
            symbol: 'TEST',
            totalSupply: 1000000,
            creatorPublicKey: process.env.CSPR_DEPLOYER_PUBLIC_KEY!, // Using deployer as creator for test
        }, { waitForConfirmation: false });

        console.log('Deployment submitted successfully!');
        console.log('Deploy Hash:', result.deployHash);
        console.log('View on Explorer: https://testnet.cspr.live/deploy/' + result.deployHash);
    } catch (error) {
        console.error('Deployment failed:');
        console.error(error instanceof Error ? error.message : error);
        console.error('Full error:', error);
    }
}

main();
