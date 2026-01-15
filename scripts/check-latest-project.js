const { PrismaClient } = require('@prisma/client');
const { CasperServiceByJsonRPC } = require('casper-js-sdk');
const dotenv = require('dotenv');
dotenv.config();

const prisma = new PrismaClient();
const Service = CasperServiceByJsonRPC || CasperServiceByJsonRPC.CasperServiceByJsonRPC;
const client = new Service(process.env.CSPR_RPC_URL_PRIMARY || "http://136.243.187.84:7777/rpc");

async function main() {
    try {
        const project = await prisma.project.findFirst({
            orderBy: { createdAt: 'desc' }
        });

        if (!project) {
            console.log("No projects found.");
            return;
        }

        console.log(`Latest Project: ${project.title} (${project.id})`);
        console.log(`Deploy Hash: ${project.tokenDeployHash}`);

        if (project.tokenDeployHash) {
            const deployInfo = await client.getDeployInfo(project.tokenDeployHash);

            const execInfo = deployInfo.execution_info;
            if (!execInfo) {
                console.log("PENDING (No execution info)");
                return;
            }

            const execResult = execInfo.execution_result;
            console.log("Exec Result Keys:", Object.keys(execResult));

            // Handle Version2
            if (execResult.Version2) {
                const v2 = execResult.Version2;
                if (v2.error_message) {
                    console.log(`FAILURE! Error: ${v2.error_message}`);
                } else {
                    console.log("SUCCESS! (Version2 execution with no error_message)");
                }
            }
            // Handle Legacy (Success/Failure directly)
            else if (execResult.Success) {
                console.log("SUCCESS!");
            } else if (execResult.Failure) {
                console.log("FAILURE!", JSON.stringify(execResult.Failure));
            } else {
                console.log("UNKNOWN Result Format");
                console.log(JSON.stringify(execResult, null, 2));
            }

        } else {
            console.log("No deploy hash for this project.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
