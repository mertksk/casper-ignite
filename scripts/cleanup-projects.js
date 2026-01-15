/**
 * Delete projects that have no token deployed
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find projects without deployed tokens
  const projectsToDelete = await prisma.project.findMany({
    where: {
      OR: [
        { tokenContractHash: null },
        { tokenStatus: { not: 'DEPLOYED' } }
      ]
    },
    select: {
      id: true,
      title: true,
      tokenSymbol: true,
      tokenStatus: true,
      tokenContractHash: true,
    }
  });

  console.log(`Found ${projectsToDelete.length} projects without deployed tokens:\n`);
  
  for (const p of projectsToDelete) {
    console.log(`- ${p.title} (${p.tokenSymbol}) - Status: ${p.tokenStatus}, Hash: ${p.tokenContractHash || 'null'}`);
  }

  if (projectsToDelete.length === 0) {
    console.log('No projects to delete.');
    return;
  }

  console.log('\nDeleting projects and related data...\n');

  for (const project of projectsToDelete) {
    // Delete related records first (foreign key constraints)
    await prisma.priceHistory.deleteMany({ where: { projectId: project.id } });
    await prisma.bondingCurve.deleteMany({ where: { projectId: project.id } });
    await prisma.projectMetric.deleteMany({ where: { projectId: project.id } });
    await prisma.trade.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    
    console.log(`✓ Deleted: ${project.title} (${project.id})`);
  }

  console.log(`\n✅ Cleanup complete. Deleted ${projectsToDelete.length} projects.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
