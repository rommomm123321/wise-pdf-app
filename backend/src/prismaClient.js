const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('Prisma initializing with DATABASE_URL:', process.env.DATABASE_URL);

// Настраиваем пулинг соединений
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Настраиваем Prisma 7 с драйвер-адаптером pg
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;