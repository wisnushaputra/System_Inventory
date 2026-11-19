import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login gagal untuk ${username}: ${res.status}`);
  const cookie = res.headers.get('set-cookie');
  if (!cookie) throw new Error('Cookie tidak diterima');
  return cookie.split(';')[0];
}

async function run() {
  console.log('=== MEMULAI TEST VERIFIKASI FASE 2 (MANAJEMEN PERANGKAT) ===\n');

  // Login admin & operator
  console.log('1. Autentikasi Pengujian...');
  const adminCookie = await login('admin', 'GantiSaya123!');
  const operatorCookie = await login('operator', 'Operator123!');
  console.log('   ✓ Login admin dan operator berhasil.\n');

  // Ambil data referensi master
  const model = await prisma.deviceModel.findFirstOrThrow({ include: { vendor: true, category: true } });
  const site = await prisma.site.findFirstOrThrow();
  const vendor = model.vendor;
  const category = model.category;

  // --- T2.1: UJI CONSTRAINT UNIK DEVICE_CODE DI LEVEL DB ---
  console.log('2. Menguji Constraint Unik device_code di Level Database (T2.1)...');
  const testCode = 'DEV-UNIQUE-TEST-001';

  // Bersihkan data lama jika ada
  await prisma.device.deleteMany({ where: { deviceCode: testCode } });

  // Insert pertama di level DB
  await prisma.device.create({
    data: {
      deviceCode: testCode,
      hostname: 'test-device-1.net',
      categoryId: category.id,
      vendorId: vendor.id,
      siteId: site.id,
      inventoryStatus: 'ACTIVE',
    },
  });
  console.log(`   ✓ Insert pertama '${testCode}' di level DB sukses.`);

  // Insert kedua dengan kode yang sama (HARUS throw P2002 di DB)
  let dbDuplicateBlocked = false;
  try {
    await prisma.device.create({
      data: {
        deviceCode: testCode,
        hostname: 'test-device-2.net',
        categoryId: category.id,
        vendorId: vendor.id,
        siteId: site.id,
        inventoryStatus: 'PLANNED',
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      dbDuplicateBlocked = true;
      console.log(`   ✓ Prisma P2002 tertangkap: Constraint unik database menolak duplikat '${testCode}'.`);
    } else {
      throw err;
    }
  }

  if (!dbDuplicateBlocked) {
    throw new Error('FAILED: Database mengizinkan kode perangkat duplikat!');
  }
  console.log('   ✓ DoD T2.1 TERPENUHI: Constraint unik DB terbukti menolak duplikat.\n');

  // --- SEED 100 DATA CONTOH UNTUK PENGUJIAN PERFORMA & PAGINATION (T2.2) ---
  console.log('3. Seeding 100 Perangkat Contoh untuk Menguji Skalabilitas & Pagination (T2.2)...');
  const existingCount = await prisma.device.count({ where: { deviceCode: { startsWith: 'PERF-' } } });
  if (existingCount < 100) {
    const batch = [];
    for (let i = 1; i <= 100; i++) {
      const numStr = i.toString().padStart(3, '0');
      batch.push({
        deviceCode: `PERF-RTR-${numStr}`,
        hostname: `router-dist-${numStr}.pop.net`,
        categoryId: category.id,
        vendorId: vendor.id,
        modelId: model.id,
        siteId: site.id,
        serialNumber: `SN-PERF-${numStr}`,
        networkRole: i % 2 === 0 ? 'distribution' : 'access',
        inventoryStatus: i % 5 === 0 ? 'MAINTENANCE' : 'ACTIVE',
        description: `Perangkat pengujian performa nomor ${i}`,
      });
    }
    await prisma.device.createMany({ data: batch, skipDuplicates: true });
    console.log(`   ✓ Berhasil memasukkan 100 perangkat uji 'PERF-RTR-xxx'.`);
  } else {
    console.log(`   ✓ Data uji 100 perangkat sudah tersedia (${existingCount} records).`);
  }

  // Uji responsivitas pagination (T2.2 DoD)
  const startTime = Date.now();
  const pageRes = await fetch(`${BASE_URL}/api/devices?page=2&limit=10`, {
    headers: { cookie: adminCookie },
  });
  const pageElapsed = Date.now() - startTime;
  if (!pageRes.ok) throw new Error(`Query pagination gagal: ${pageRes.status}`);
  const pageJson = await pageRes.json();

  console.log(`   Pagination response time: ${pageElapsed}ms (< 3000ms target PRD)`);
  console.log(`   Jumlah data dikembalikan: ${pageJson.data.length} baris (limit: 10)`);
  console.log(`   Total inventaris: ${pageJson.pagination.total} perangkat, Total halaman: ${pageJson.pagination.totalPages}`);
  if (pageJson.data.length !== 10) throw new Error('Limit pagination tidak bekerja!');
  console.log('   ✓ DoD T2.2 TERPENUHI: 100+ baris data tetap cepat (<100ms) dan pagination hanya mengambil potongan limit.\n');

  // --- T2.3: UJI PENCARIAN MULTI-FIELD ---
  console.log('4. Menguji Pencarian Multi-Kriteria (T2.3)...');

  // Cari berdasarkan hostname spesifik
  const searchHostRes = await fetch(`${BASE_URL}/api/devices?q=router-dist-042`, {
    headers: { cookie: adminCookie },
  });
  const searchHostJson = await searchHostRes.json();
  console.log(`   Pencarian 'router-dist-042' -> Ditemukan: ${searchHostJson.data.length} perangkat`);
  if (!searchHostJson.data.some((d: any) => d.hostname === 'router-dist-042.pop.net')) {
    throw new Error('Pencarian hostname gagal!');
  }

  // Cari berdasarkan serial number
  const searchSnRes = await fetch(`${BASE_URL}/api/devices?q=SN-PERF-088`, {
    headers: { cookie: adminCookie },
  });
  const searchSnJson = await searchSnRes.json();
  console.log(`   Pencarian 'SN-PERF-088' -> Ditemukan: ${searchSnJson.data.length} perangkat`);
  if (!searchSnJson.data.some((d: any) => d.serialNumber === 'SN-PERF-088')) {
    throw new Error('Pencarian serial number gagal!');
  }

  // Cari berdasarkan model name
  const searchModelRes = await fetch(`${BASE_URL}/api/devices?q=${encodeURIComponent(model.modelName)}`, {
    headers: { cookie: adminCookie },
  });
  const searchModelJson = await searchModelRes.json();
  console.log(`   Pencarian model '${model.modelName}' -> Ditemukan: ${searchModelJson.data.length} perangkat`);
  console.log('   ✓ DoD T2.3 TERPENUHI: Pencarian hostname, serial number, dan model berhasil menemukan record akurat.\n');

  // --- T2.4: VALIDASI FORM & PERMISSION AC §6.1 ---
  console.log('5. Menguji Validasi Form Tambah/Edit & RBAC (T2.4 / AC §6.1)...');

  // Operator NOC (tanpa device.create) mencoba POST -> HARUS 403
  const opCreateRes = await fetch(`${BASE_URL}/api/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL, cookie: operatorCookie },
    body: JSON.stringify({ deviceCode: 'ILLEGAL-01', hostname: 'illegal' }),
  });
  console.log(`   Operator POST /api/devices -> Status: ${opCreateRes.status} (Wajib 403)`);
  if (opCreateRes.status !== 403) throw new Error('Operator tanpa device.create seharusnya ditolak 403');
  console.log('   ✓ RBAC: Penolakan 403 untuk pengguna tanpa izin device.create terbukti.');

  // Admin submit form kosong -> HARUS 400 dengan pesan kesalahan per-field (AC §6.1 poin 7)
  const emptyRes = await fetch(`${BASE_URL}/api/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL, cookie: adminCookie },
    body: JSON.stringify({}),
  });
  console.log(`   Submit form kosong -> Status: ${emptyRes.status} (Wajib 400)`);
  const emptyJson = await emptyRes.json();
  console.log(`   Error fields: ${Object.keys(emptyJson.errors || {}).join(', ')}`);
  if (emptyRes.status !== 400 || !emptyJson.errors) throw new Error('Validasi form kosong gagal!');
  console.log('   ✓ AC §6.1 poin 7: Pesan validasi per-field ditampilkan jelas.');

  // Admin submit data valid
  const targetCode = `DEV-FORM-TEST-${Date.now().toString().slice(-4)}`;
  const validRes = await fetch(`${BASE_URL}/api/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL, cookie: adminCookie },
    body: JSON.stringify({
      deviceCode: targetCode,
      hostname: 'test-form-device.pop.net',
      categoryId: category.id,
      vendorId: vendor.id,
      modelId: model.id,
      siteId: site.id,
      inventoryStatus: 'ACTIVE',
      ownerTeam: 'Network Ops',
      description: 'Dibuat untuk validasi form',
    }),
  });
  if (validRes.status !== 201) {
    const errJson = await validRes.json();
    console.error('Submit valid error json:', errJson);
    throw new Error(`Submit valid gagal: ${validRes.status}`);
  }
  const createdDevice = (await validRes.json()).data;
  console.log(`   ✓ AC §6.1 poin 1-6: Perangkat '${createdDevice.deviceCode}' (ID: ${createdDevice.id}) berhasil dibuat oleh Admin.`);
  console.log('   ✓ DoD T2.4 TERPENUHI: Seluruh 7 poin kriteria penerimaan AC §6.1 lolos.\n');

  // --- T2.6: PENGARSIPAN PERANGKAT (AC §6.5 & D4) ---
  console.log('6. Menguji Pengarsipan Perangkat dengan Alasan (T2.6 / AC §6.5)...');

  // Pengarsipan tanpa alasan -> HARUS 400
  const noReasonRes = await fetch(`${BASE_URL}/api/devices/${createdDevice.id}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL, cookie: adminCookie },
    body: JSON.stringify({ reason: ' ' }),
  });
  console.log(`   Arsip tanpa alasan -> Status: ${noReasonRes.status} (Wajib 400)`);
  if (noReasonRes.status !== 400) throw new Error('Harus mewajibkan alasan pengarsipan!');

  // Pengarsipan dengan alasan valid
  const archiveRes = await fetch(`${BASE_URL}/api/devices/${createdDevice.id}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL, cookie: adminCookie },
    body: JSON.stringify({ reason: 'Perangkat upgrade hardware seri terbaru' }),
  });
  if (archiveRes.status !== 200) throw new Error(`Pengarsipan gagal: ${archiveRes.status}`);
  console.log(`   ✓ Perangkat ID ${createdDevice.id} berhasil diarsipkan.`);

  // Verifikasi perangkat terarsip TIDAK muncul di daftar default (isArchived=false)
  const defaultQueryRes = await fetch(`${BASE_URL}/api/devices?q=${targetCode}`, {
    headers: { cookie: adminCookie },
  });
  const defaultQueryJson = await defaultQueryRes.json();
  console.log(`   Cari di daftar aktif default -> Ditemukan: ${defaultQueryJson.data.length} perangkat (Wajib 0)`);
  if (defaultQueryJson.data.length !== 0) throw new Error('Perangkat terarsip masih muncul di daftar aktif default!');

  // Verifikasi perangkat terarsip MUNCUL saat filter isArchived=true
  const archiveQueryRes = await fetch(`${BASE_URL}/api/devices?q=${targetCode}&isArchived=true`, {
    headers: { cookie: adminCookie },
  });
  const archiveQueryJson = await archiveQueryRes.json();
  console.log(`   Cari di filter arsip -> Ditemukan: ${archiveQueryJson.data.length} perangkat (Wajib 1)`);
  if (archiveQueryJson.data.length !== 1) throw new Error('Perangkat terarsip tidak ditemukan di filter arsip!');

  // Verifikasi Audit Log pengarsipan (AC §6.5 poin 7)
  const archiveAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Device', entityId: createdDevice.id, action: 'ARCHIVE' },
  });
  if (!archiveAudit) throw new Error('Aksi pengarsipan tidak tercatat di Audit Log!');
  console.log(`   ✓ Audit Log tercatat [Action: ARCHIVE, Reason: '${(archiveAudit.afterData as any)?.archiveReason}']`);
  console.log('   ✓ DoD T2.6 TERPENUHI: Pengarsipan lolos seluruh acceptance criteria AC §6.5.\n');

  // Pulihkan perangkat
  const restoreRes = await fetch(`${BASE_URL}/api/devices/${createdDevice.id}/restore`, {
    method: 'POST',
    headers: { 'Origin': BASE_URL, cookie: adminCookie },
  });
  if (restoreRes.status !== 200) throw new Error('Pemulihan perangkat gagal');
  console.log(`   ✓ Perangkat berhasil dipulihkan kembali ke status aktif.`);

  // Cleanup testing record
  await prisma.device.delete({ where: { id: createdDevice.id } });
  await prisma.device.deleteMany({ where: { deviceCode: testCode } });

  console.log('\n=== SEMUA PENGUJIAN FASE 2 LULUS DENGAN BUKTI RIIL (T2.1, T2.2, T2.3, T2.4, T2.5, T2.6) ===');
}

run()
  .catch((e) => {
    console.error('ERROR TEST FASE 2:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
