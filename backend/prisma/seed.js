import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { products } from './catalog.js';
const prisma = new PrismaClient();

// WARNING: development reset. Deletes all orders and products. Do not run on a deployed database;
// use `npm run db:seed:initial` there instead.

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: products });
  console.log(`Seeded ${products.length} ShopSmart products.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
