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

const CATEGORIES = [
  { code: 'router', name: 'Router', description: 'Perangkat routing layer 3' },
  { code: 'switch', name: 'Switch', description: 'Perangkat switching layer 2 / 3' },
  { code: 'olt', name: 'OLT', description: 'Optical Line Terminal untuk fiber' },
  { code: 'ont', name: 'ONT', description: 'Optical Network Terminal sisi pelanggan' },
  { code: 'server', name: 'Server', description: 'Server fisik atau host sistem' },
  { code: 'radio', name: 'Radio / Wireless', description: 'Perangkat radio wireless point-to-point' },
  { code: 'firewall', name: 'Firewall', description: 'Perangkat keamanan dan filter lalu lintas' },
  { code: 'other', name: 'Lainnya', description: 'Perangkat infrastruktur lainnya' },
];

const VENDORS = [
  { name: 'Cisco', website: 'https://www.cisco.com', supportContact: 'support@cisco.com', notes: 'Vendor perangkat enterprise' },
  { name: 'MikroTik', website: 'https://mikrotik.com', supportContact: 'support@mikrotik.com', notes: 'RouterOS & switch router' },
  { name: 'Huawei', website: 'https://huawei.com', supportContact: 'support@huawei.com', notes: 'Perangkat OLT & transmisi' },
  { name: 'Juniper', website: 'https://juniper.net', supportContact: 'support@juniper.net', notes: 'Perangkat core & edge router' },
];

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

  // User operator contoh untuk verifikasi permission
  const nocRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Operator NOC' } });
  await prisma.user.upsert({
    where: { username: 'operator' },
    update: {},
    create: {
      name: 'Operator NOC',
      username: 'operator',
      roleId: nocRole.id,
      passwordHash: await hashPassword(process.env.OPERATOR_PASSWORD ?? 'Operator123!'),
      isActive: true,
    },
  });

  // Seed Categories
  for (const cat of CATEGORIES) {
    await prisma.deviceCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
  }

  // Seed Vendors
  for (const v of VENDORS) {
    await prisma.vendor.upsert({
      where: { name: v.name },
      update: { website: v.website, supportContact: v.supportContact, notes: v.notes },
      create: v,
    });
  }

  // Seed Contoh Site, Room, Rack
  const siteBdg = await prisma.site.upsert({
    where: { siteCode: 'POP-BDG-01' },
    update: {},
    create: {
      siteCode: 'POP-BDG-01',
      name: 'POP Bandung Dago',
      siteType: 'pop',
      address: 'Jl. Ir. H. Juanda No. 100',
      city: 'Bandung',
      province: 'Jawa Barat',
      status: 'active',
      description: 'Point of Presence area Dago Bandung',
    },
  });

  const roomBdg = await prisma.room.upsert({
    where: { siteId_name: { siteId: siteBdg.id, name: 'Server Room 1' } },
    update: {},
    create: {
      siteId: siteBdg.id,
      name: 'Server Room 1',
      floor: 'Lantai 2',
      description: 'Ruang server utama',
    },
  });

  await prisma.rack.upsert({
    where: { siteId_name: { siteId: siteBdg.id, name: 'Rack-A01' } },
    update: {},
    create: {
      siteId: siteBdg.id,
      roomId: roomBdg.id,
      name: 'Rack-A01',
      unitCapacity: 42,
      description: 'Rack distribusi utama',
    },
  });

  // Seed Contoh Model
  const mikrotikVendor = await prisma.vendor.findUniqueOrThrow({ where: { name: 'MikroTik' } });
  const routerCat = await prisma.deviceCategory.findUniqueOrThrow({ where: { code: 'router' } });

  await prisma.deviceModel.upsert({
    where: { modelCode: 'CCR1036-8G-2S+' },
    update: {},
    create: {
      vendorId: mikrotikVendor.id,
      categoryId: routerCat.id,
      modelName: 'Cloud Core Router 1036-8G-2S+',
      modelCode: 'CCR1036-8G-2S+',
      description: 'Router 36 core dengan 8 port GbE dan 2 port SFP+',
    },
  });

  console.log('SEED OK →', {
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    users: await prisma.user.count(),
    categories: await prisma.deviceCategory.count(),
    vendors: await prisma.vendor.count(),
    sites: await prisma.site.count(),
    models: await prisma.deviceModel.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
