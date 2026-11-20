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

  // Seed Contoh Site, Room, Rack & Customer Sites (Hierarki)
  const siteBdg = await prisma.site.upsert({
    where: { siteCode: 'POP-BDG-01' },
    update: {
      name: 'POP Bandung Dago',
      siteType: 'pop',
      address: 'Jl. Ir. H. Juanda No. 100',
      city: 'Bandung',
      province: 'Jawa Barat',
      status: 'active',
      description: 'Point of Presence area Dago Bandung',
    },
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

  const siteJkt = await prisma.site.upsert({
    where: { siteCode: 'POP-JKT-01' },
    update: {
      name: 'POP Jakarta Cyber',
      siteType: 'pop',
      address: 'Gedung Cyber 1 Lt. 3, Jl. Kuningan Barat No. 8',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      status: 'active',
      description: 'Point of Presence Gedung Cyber Kuningan',
    },
    create: {
      siteCode: 'POP-JKT-01',
      name: 'POP Jakarta Cyber',
      siteType: 'pop',
      address: 'Gedung Cyber 1 Lt. 3, Jl. Kuningan Barat No. 8',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      status: 'active',
      description: 'Point of Presence Gedung Cyber Kuningan',
    },
  });

  // Customer Sites di bawah POP-BDG-01
  const custTlk = await prisma.site.upsert({
    where: { siteCode: 'CUST-TLK-01' },
    update: {
      name: 'PT Telkom Dago Hub',
      siteType: 'customer_site',
      parentSiteId: siteBdg.id,
      address: 'Jl. Lembong No. 11',
      city: 'Bandung',
      province: 'Jawa Barat',
      status: 'active',
      description: 'Pelanggan Enterprise Telkom Hub Dago',
    },
    create: {
      siteCode: 'CUST-TLK-01',
      name: 'PT Telkom Dago Hub',
      siteType: 'customer_site',
      parentSiteId: siteBdg.id,
      address: 'Jl. Lembong No. 11',
      city: 'Bandung',
      province: 'Jawa Barat',
      status: 'active',
      description: 'Pelanggan Enterprise Telkom Hub Dago',
    },
  });

  const custBca = await prisma.site.upsert({
    where: { siteCode: 'CUST-BCA-01' },
    update: {
      name: 'Bank BCA KCU Dago',
      siteType: 'customer_site',
      parentSiteId: siteBdg.id,
      address: 'Jl. Ir. H. Juanda No. 122',
      city: 'Bandung',
      province: 'Jawa Barat',
      status: 'active',
      description: 'Pelanggan Perbankan BCA KCU Dago',
    },
    create: {
      siteCode: 'CUST-BCA-01',
      name: 'Bank BCA KCU Dago',
      siteType: 'customer_site',
      parentSiteId: siteBdg.id,
      address: 'Jl. Ir. H. Juanda No. 122',
      city: 'Bandung',
      province: 'Jawa Barat',
      status: 'active',
      description: 'Pelanggan Perbankan BCA KCU Dago',
    },
  });

  const custItb = await prisma.site.upsert({
    where: { siteCode: 'CUST-ITB-01' },
    update: {
      name: 'Institut Teknologi Bandung (Ganesha)',
      siteType: 'customer_site',
      parentSiteId: siteBdg.id,
      address: 'Jl. Ganesha No. 10',
      city: 'Bandung',
      province: 'Jawa Barat',
      status: 'active',
      description: 'Pelanggan Institusi Pendidikan ITB',
    },
    create: {
      siteCode: 'CUST-ITB-01',
      name: 'Institut Teknologi Bandung (Ganesha)',
      siteType: 'customer_site',
      parentSiteId: siteBdg.id,
      address: 'Jl. Ganesha No. 10',
      city: 'Bandung',
      province: 'Jawa Barat',
      status: 'active',
      description: 'Pelanggan Institusi Pendidikan ITB',
    },
  });

  // Customer Sites di bawah POP-JKT-01
  const custMdr = await prisma.site.upsert({
    where: { siteCode: 'CUST-MDR-01' },
    update: {
      name: 'Bank Mandiri Tower Sudirman',
      siteType: 'customer_site',
      parentSiteId: siteJkt.id,
      address: 'Jl. Jend. Sudirman Kav. 54-55',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      status: 'active',
      description: 'Pelanggan Perbankan Mandiri Tower',
    },
    create: {
      siteCode: 'CUST-MDR-01',
      name: 'Bank Mandiri Tower Sudirman',
      siteType: 'customer_site',
      parentSiteId: siteJkt.id,
      address: 'Jl. Jend. Sudirman Kav. 54-55',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      status: 'active',
      description: 'Pelanggan Perbankan Mandiri Tower',
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
  const ciscoVendor = await prisma.vendor.findUniqueOrThrow({ where: { name: 'Cisco' } });
  const routerCat = await prisma.deviceCategory.findUniqueOrThrow({ where: { code: 'router' } });
  const switchCat = await prisma.deviceCategory.findUniqueOrThrow({ where: { code: 'switch' } });

  const ccrModel = await prisma.deviceModel.upsert({
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

  const catalystModel = await prisma.deviceModel.upsert({
    where: { modelCode: 'WS-C2960X-24TS-L' },
    update: {},
    create: {
      vendorId: ciscoVendor.id,
      categoryId: switchCat.id,
      modelName: 'Catalyst 2960-X 24 GigE',
      modelCode: 'WS-C2960X-24TS-L',
      description: 'Switch enterprise 24 port GbE dan 4 SFP',
    },
  });

  // Seed Perangkat contoh
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });

  await prisma.device.upsert({
    where: { deviceCode: 'DEV-BDG-RTR-01' },
    update: {},
    create: {
      deviceCode: 'DEV-BDG-RTR-01',
      hostname: 'pop-bdg-core01',
      categoryId: routerCat.id,
      vendorId: mikrotikVendor.id,
      modelId: ccrModel.id,
      serialNumber: 'MT-CCR-992144',
      siteId: siteBdg.id,
      roomId: roomBdg.id,
      networkRole: 'core',
      inventoryStatus: 'ACTIVE',
      createdBy: adminUser.id,
      description: 'Core router utama POP Bandung',
    },
  });

  await prisma.device.upsert({
    where: { deviceCode: 'DEV-TLK-SW-01' },
    update: {},
    create: {
      deviceCode: 'DEV-TLK-SW-01',
      hostname: 'cust-tlk-sw01',
      categoryId: switchCat.id,
      vendorId: ciscoVendor.id,
      modelId: catalystModel.id,
      serialNumber: 'CS-CAT-881230',
      siteId: custTlk.id,
      networkRole: 'distribution',
      inventoryStatus: 'ACTIVE',
      createdBy: adminUser.id,
      description: 'Switch distribusi pelanggan PT Telkom',
    },
  });

  await prisma.device.upsert({
    where: { deviceCode: 'DEV-BCA-RTR-01' },
    update: {},
    create: {
      deviceCode: 'DEV-BCA-RTR-01',
      hostname: 'cust-bca-gw01',
      categoryId: routerCat.id,
      vendorId: mikrotikVendor.id,
      modelId: ccrModel.id,
      serialNumber: 'MT-CCR-330192',
      siteId: custBca.id,
      networkRole: 'cpe',
      inventoryStatus: 'ACTIVE',
      createdBy: adminUser.id,
      description: 'Gateway CPE router pelanggan Bank BCA',
    },
  });

  await prisma.device.upsert({
    where: { deviceCode: 'DEV-ITB-SW-01' },
    update: {},
    create: {
      deviceCode: 'DEV-ITB-SW-01',
      hostname: 'cust-itb-sw01',
      categoryId: switchCat.id,
      vendorId: ciscoVendor.id,
      modelId: catalystModel.id,
      serialNumber: 'CS-CAT-110023',
      siteId: custItb.id,
      networkRole: 'access',
      inventoryStatus: 'ACTIVE',
      createdBy: adminUser.id,
      description: 'Switch akses Lab Komputer ITB Ganesha',
    },
  });

  await prisma.device.upsert({
    where: { deviceCode: 'DEV-MDR-SW-01' },
    update: {},
    create: {
      deviceCode: 'DEV-MDR-SW-01',
      hostname: 'cust-mdr-sw01',
      categoryId: switchCat.id,
      vendorId: ciscoVendor.id,
      modelId: catalystModel.id,
      serialNumber: 'CS-CAT-445566',
      siteId: custMdr.id,
      networkRole: 'cpe',
      inventoryStatus: 'ACTIVE',
      createdBy: adminUser.id,
      description: 'Switch CPE pelanggan Bank Mandiri Tower',
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
