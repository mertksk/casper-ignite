
import 'dotenv/config';
import { deployProjectToken } from '../src/lib/casper';

async function main() {
    console.log("Testing deployment with SDK v2...");

    const result = await deployProjectToken(
        {
            projectName: "GeminiV2Test",
            symbol: "GEMV2",
            decimals: 9,
            totalSupply: 1_000_000,
            creatorPublicKey: process.env.CSPR_DEPLOYER_PUBLIC_KEY || "",
        },
        { waitForConfirmation: false }
    );

    console.log("Deploy submitted:", result.deployHash);
    console.log(`Check status: https://testnet.cspr.live/deploy/${result.deployHash}`);
}

main().catch(console.error);
