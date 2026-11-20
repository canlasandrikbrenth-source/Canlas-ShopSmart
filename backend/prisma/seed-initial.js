// Non-destructive first-deploy seed: inserts the sample catalog ONLY when the Product table is empty.
// Unlike prisma/seed.js it never deletes orders, users or products, so it is safe to re-run on a deployed database.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { products } from './catalog.js';
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log(`Product table already has ${existing} row(s); no changes made.`);
    return;
  }
  await prisma.product.createMany({ data: products });
  console.log(`Inserted ${products.length} sample products into an empty catalog.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
