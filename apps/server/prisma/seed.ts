import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@smartbooking.com' },
    update: {},
    create: {
      email: 'admin@smartbooking.com',
      name: 'System Admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // 2. Create Sample Slots
  const now = new Date();
  
  const slot1 = await prisma.slot.create({
    data: {
      startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
      endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // +2 Hours
      capacity: 10,
    },
  });

  const slot2 = await prisma.slot.create({
    data: {
      startTime: new Date(now.getTime() + 48 * 60 * 60 * 1000), // Day after tomorrow
      endTime: new Date(now.getTime() + 48 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      capacity: 5,
    },
  });

  console.log('Seeding finished successfully!');
  console.log({ admin: admin.email, slotsCreated: [slot1.id, slot2.id] });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });