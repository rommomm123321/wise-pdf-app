const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  const roles = await prisma.role.findMany({
    orderBy: { createdAt: 'asc' }
  });

  const seen = new Set();
  const toDelete = [];

  for (const role of roles) {
    const key = `${role.companyId}-${role.name}`;
    if (seen.has(key)) {
      toDelete.push(role.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    console.log(`Found ${toDelete.length} duplicate roles. Deleting...`);
    // First remove them from any users to avoid foreign key constraints (usually onDelete: Cascade handles this)
    await prisma.role.deleteMany({
      where: { id: { in: toDelete } }
    });
    console.log('Deleted duplicate roles.');
  } else {
    console.log('No duplicate roles found.');
  }
}

cleanup()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
