const prisma = require('./src/prismaClient');

async function main() {
  const email = process.argv[2] || 'rommomm123321@gmail.com';
  try {
    const res = await prisma.user.updateMany({
      where: { email },
      data: { role: 'GENERAL_ADMIN' }
    });
    console.log(`Updated ${res.count} user(s) to GENERAL_ADMIN`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
