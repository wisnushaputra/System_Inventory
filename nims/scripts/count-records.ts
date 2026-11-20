import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function countAll() {
  const counts = {
    devices: await prisma.device.count(),
    interfaces: await prisma.interface.count(),
    ipAddresses: await prisma.ipAddress.count(),
    subnets: await prisma.subnet.count(),
    connections: await prisma.networkConnection.count(),
    documents: await prisma.document.count(),
    auditLogs: await prisma.auditLog.count(),
    topologyLayouts: await prisma.topologyLayout.count(),
    sites: await prisma.site.count(),
    rooms: await prisma.room.count(),
    racks: await prisma.rack.count(),
    models: await prisma.deviceModel.count(),
    vendors: await prisma.vendor.count(),
    categories: await prisma.deviceCategory.count(),
    users: await prisma.user.count(),
  };
  console.log(JSON.stringify(counts, null, 2));
}

countAll().finally(() => prisma.$disconnect());
