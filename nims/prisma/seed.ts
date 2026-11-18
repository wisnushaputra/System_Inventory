import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL kosong — jalankan: npm run db:seed');
  process.exit(1);
}

const prisma = new PrismaClient();

const PERMISSIONS = [
  'dashboard.view',
  'device.view', 'device.create', 'device.update', 'device.archive',
  'site.view', 'site.manage', 'vendor.manage',
  'interface.view', 'interface.manage',
  'ipam.view', 'ipam.manage', 'vlan.view', 'vlan.manage',
  'topology.view', 'topology.manage',
  'document.view', 'document.upload',
  'audit.view', 'user.manage', 'report.export',
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: PERMISSIONS,
  'Network Engineer': PERMISSIONS.filter((p) => !['user.manage', 'audit.view'].includes(p)),
  'Operator NOC': ['dashboard.view', 'device.view', 'site.view', 'interface.view', 'ipam.view', 'vlan.view', 'topology.view', 'document.view'],
  Supervisor: ['dashboard.view', 'device.view', 'site.view', 'ipam.view', 'vlan.view', 'topology.view', 'document.view', 'audit.view', 'report.export'],
};

async function main() {
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code, name: code } });
  }

  for (const [name, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    for (const code of codes) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'Administrator',
      username: 'admin',
      roleId: adminRole.id,
      passwordHash: await hashPassword(process.env.ADMIN_PASSWORD ?? 'GantiSaya123!'),
      isActive: true,
    },
  });

  console.log('SEED OK →', {
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    users: await prisma.user.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
