/**
 * Clear Operational Data Script
 * Clears all operational inventory data while preserving:
 * - User accounts (Admin, Operator NOC)
 * - Roles & Permissions
 * - Master Categories (Router, Switch, OLT, etc.)
 * - Master Vendors (Cisco, MikroTik, Huawei, Juniper)
 * - Master Site/Room/Rack references
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== MENGOSONGKAN DATA OPERASIONAL INVENTARIS (NIMS) ===\n');

  console.log('1. Menghapus seluruh relasi koneksi jaringan (network_connections)...');
  const deletedConnections = await prisma.networkConnection.deleteMany({});
  console.log(`   ✓ Dihapus: ${deletedConnections.count} koneksi`);

  console.log('2. Menghapus seluruh alokasi alamat IP (ip_addresses)...');
  const deletedIps = await prisma.ipAddress.deleteMany({});
  console.log(`   ✓ Dihapus: ${deletedIps.count} alamat IP`);

  console.log('3. Menghapus seluruh port/antarmuka perangkat (interfaces)...');
  const deletedInterfaces = await prisma.interface.deleteMany({});
  console.log(`   ✓ Dihapus: ${deletedInterfaces.count} port`);

  console.log('4. Menghapus seluruh lampiran dokumen privat (documents)...');
  const deletedDocs = await prisma.document.deleteMany({});
  console.log(`   ✓ Dihapus: ${deletedDocs.count} dokumen`);

  console.log('5. Menghapus seluruh posisi tata letak topologi (topology_layouts)...');
  const deletedLayouts = await prisma.topologyLayout.deleteMany({});
  console.log(`   ✓ Dihapus: ${deletedLayouts.count} layout`);

  console.log('6. Menghapus seluruh perangkat inventaris (devices)...');
  const deletedDevices = await prisma.device.deleteMany({});
  console.log(`   ✓ Dihapus: ${deletedDevices.count} perangkat`);

  console.log('7. Menghapus seluruh subnet IPAM (subnets)...');
  const deletedSubnets = await prisma.subnet.deleteMany({});
  console.log(`   ✓ Dihapus: ${deletedSubnets.count} subnet`);

  console.log('8. Menghapus seluruh riwayat audit log (audit_logs)...');
  const deletedLogs = await prisma.auditLog.deleteMany({});
  console.log(`   ✓ Dihapus: ${deletedLogs.count} log`);

  // Hapus model yang dibuat otomatis oleh impor jika ada
  const deletedAutoModels = await prisma.deviceModel.deleteMany({
    where: {
      OR: [
        { description: { contains: 'impor' } },
        { description: { contains: 'Import' } },
        { modelCode: { contains: '-' } },
      ],
      NOT: { modelCode: 'CCR1036-8G-2S+' },
    },
  });
  if (deletedAutoModels.count > 0) {
    console.log(`   ✓ Dihapus: ${deletedAutoModels.count} model sementara uji coba`);
  }

  // Verifikasi status akhir
  const status = {
    devices: await prisma.device.count(),
    interfaces: await prisma.interface.count(),
    ipAddresses: await prisma.ipAddress.count(),
    subnets: await prisma.subnet.count(),
    connections: await prisma.networkConnection.count(),
    documents: await prisma.document.count(),
    auditLogs: await prisma.auditLog.count(),
    topologyLayouts: await prisma.topologyLayout.count(),
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    categories: await prisma.deviceCategory.count(),
    vendors: await prisma.vendor.count(),
    sites: await prisma.site.count(),
    rooms: await prisma.room.count(),
    racks: await prisma.rack.count(),
  };

  console.log('\n============================================================');
  console.log('📊 STATUS AKHIR BASIS DATA:');
  console.log('--- Data Operasional (Harus 0) ---');
  console.log(`   - Perangkat (Devices):          ${status.devices}`);
  console.log(`   - Port/Antarmuka (Interfaces):   ${status.interfaces}`);
  console.log(`   - Alamat IP (IP Addresses):      ${status.ipAddresses}`);
  console.log(`   - Subnet IPAM:                   ${status.subnets}`);
  console.log(`   - Relasi Koneksi (Connections):  ${status.connections}`);
  console.log(`   - Dokumen Lampiran:              ${status.documents}`);
  console.log(`   - Audit Logs:                    ${status.auditLogs}`);
  console.log(`   - Layout Topologi:               ${status.topologyLayouts}`);
  console.log('--- Master Data & Akun (Tetap Siap Digunakan) ---');
  console.log(`   - Akun Pengguna (Users):         ${status.users} (admin & operator siap login)`);
  console.log(`   - Peran (Roles):                 ${status.roles}`);
  console.log(`   - Kategori Perangkat:            ${status.categories}`);
  console.log(`   - Vendor Pabrikan:               ${status.vendors}`);
  console.log(`   - Site / Lokasi POP:             ${status.sites}`);
  console.log('============================================================\n');

  console.log('✅ SELURUH DATA OPERASIONAL TELAH BERSIH 100%!');
}

main()
  .catch((err) => {
    console.error('❌ Gagal mengosongkan data:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
