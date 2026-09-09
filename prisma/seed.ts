import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client'; // Import standard package
import * as bcrypt from 'bcryptjs'; // Required import for bcrypt

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  await prisma.user.create({
    data: {
      email: 'superadmin@dosje.gov.in',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: Role.DOSJE_SUPER_ADMIN,
      status: 'ACTIVE',
      jurisdictionState: 'All India',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });