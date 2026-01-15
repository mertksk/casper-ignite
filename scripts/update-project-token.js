/**
 * Update project with deployed token contract hash
 * Run: node scripts/update-project-token.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PROJECT_ID = 'cmkeob38p0000ifov6gl39uia';
const CONTRACT_HASH = 'hash-10908ad5d167933ec174582e49efa1484e9d22d7eb912555500341ea86ddf2c6';
const PACKAGE_HASH = 'hash-a20646052f1232bec433d9f7a0a3f467ad047b14ffae6291fc78a1c740fd05b8';
const DEPLOY_HASH = '7fbc6365c05c8f99b1f9ef5c02cc6c5cc2ffbb440bc4951a24f19652c51ce5c2';

async function main() {
    console.log(`Updating project ${PROJECT_ID}...`);

    const updated = await prisma.project.update({
        where: { id: PROJECT_ID },
        data: {
            tokenContractHash: CONTRACT_HASH,
            tokenPackageHash: PACKAGE_HASH,
            tokenDeployHash: DEPLOY_HASH,
            tokenStatus: 'DEPLOYED',
        },
    });

    console.log('Project updated successfully:');
    console.log(`  - Token Status: ${updated.tokenStatus}`);
    console.log(`  - Contract Hash: ${updated.tokenContractHash}`);
    console.log(`  - Package Hash: ${updated.tokenPackageHash}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
