
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getContractHashesFromDeploy, waitForDeploy, sendTokenTransfer } from '../src/lib/casper';

const prisma = new PrismaClient();

async function main() {
    const arg = process.argv[2];
    if (!arg) {
        console.error("Usage: npx tsx scripts/debug-project.ts <projectId>");
        process.exit(1);
    }

    const projectId = arg;
    console.log(`Checking project ${projectId}...`);

    const project = await prisma.project.findUnique({
        where: { id: projectId }
    });

    if (!project) {
        console.error("Project not found in DB");
        process.exit(1);
    }

    console.log("DB State:", {
        id: project.id,
        title: project.title,
        tokenStatus: project.tokenStatus,
        tokenDeployHash: project.tokenDeployHash,
        tokenContractHash: project.tokenContractHash,
        createdAt: project.createdAt,
        creatorTokenAmount: project.creatorTokenAmount
    });

    if (project.tokenStatus !== 'DEPLOYED' && project.tokenDeployHash) {
        console.log(`\nWaiting for Token Deploy (timeout 30m): ${project.tokenDeployHash}`);

        try {
            const status = await waitForDeploy(project.tokenDeployHash);
            console.log("Deploy Status:", status);

            if (status.executed && status.success) {
                console.log("Deploy confirmed! Fetching hashes...");
                const hashes = await getContractHashesFromDeploy(project.tokenDeployHash);
                console.log("Found Hashes:", hashes);

                if (hashes.contractHash) {
                    console.log("\nUPDATING PROJECT STATUS -> DEPLOYED");
                    const updated = await prisma.project.update({
                        where: { id: projectId },
                        data: {
                            tokenStatus: 'DEPLOYED',
                            tokenContractHash: hashes.contractHash,
                            tokenPackageHash: hashes.contractPackageHash
                        }
                    });
                    console.log("Project updated successfully.");

                    // Now Handle Distribution
                    if (project.creatorTokenAmount && project.creatorTokenAmount > 0) {
                        if (project.tokenDistributionHash) {
                            console.log("Distribution already attempted:", project.tokenDistributionHash);
                        } else {
                            console.log(`\n[Distribution] Sending ${project.creatorTokenAmount} tokens to creator...`);
                            try {
                                const transferRes = await sendTokenTransfer({
                                    projectId: project.id,
                                    tokenContractHash: hashes.contractHash,
                                    toAddress: project.creatorAddress,
                                    tokenAmount: project.creatorTokenAmount
                                });
                                console.log(`[Distribution] Transfer Submitted: ${transferRes.deployHash}`);

                                await prisma.project.update({
                                    where: { id: projectId },
                                    data: { tokenDistributionHash: transferRes.deployHash }
                                });
                                console.log("[Distribution] Hash saved to DB.");
                            } catch (distErr) {
                                console.error("[Distribution] Failed:", distErr);
                            }
                        }
                    }

                } else {
                    console.error("Deploy succeeded but validation failed (no contract hash).");
                }
            } else {
                console.error("Deploy failed or rejected.");
                await prisma.project.update({
                    where: { id: projectId },
                    data: { tokenStatus: 'FAILED' }
                });
            }
        } catch (e) {
            console.error("Error during checking/fixing:", e);
        }
    } else if (project.tokenStatus === 'DEPLOYED') {
        console.log("Project is already DEPLOYED.");
        // Could check/retry distribution if missing
        if (project.creatorTokenAmount && project.creatorTokenAmount > 0 && !project.tokenDistributionHash && project.tokenContractHash) {
            console.log("Distribution missing. Retrying...");
            // Reuse distribution logic...
            try {
                const transferRes = await sendTokenTransfer({
                    projectId: project.id,
                    tokenContractHash: project.tokenContractHash,
                    toAddress: project.creatorAddress,
                    tokenAmount: project.creatorTokenAmount
                });
                console.log(`[Distribution] Transfer Submitted: ${transferRes.deployHash}`);
                await prisma.project.update({ where: { id: projectId }, data: { tokenDistributionHash: transferRes.deployHash } });
            } catch (err) { console.error(err); }
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
