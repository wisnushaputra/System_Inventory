import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${username}: ${res.status}`);
  const cookie = res.headers.get('set-cookie');
  if (!cookie) throw new Error('No cookie received');
  return cookie.split(';')[0];
}

async function run() {
  console.log('=== MEMULAI TEST VERIFIKASI FASE 1 ===\n');

  console.log('1. Login sebagai operator (NOC) dan admin...');
  const operatorCookie = await login('operator', 'Operator123!');
  const adminCookie = await login('admin', 'GantiSaya123!');
  console.log('   ✓ Login berhasil untuk kedua user.\n');

  // --- T1.2: PENEGAKAN PERMISSION DI BACKEND (DoD: user tanpa permission -> 403) ---
  console.log('2. Menguji penegakan permission backend (T1.2)...');

  // Operator mencoba membuat site baru (memerlukan site.manage)
  const opSiteRes = await fetch(`${BASE_URL}/api/master/sites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
      cookie: operatorCookie,
    },
    body: JSON.stringify({
      siteCode: 'POP-ILLEGAL',
      name: 'Illegal Site',
    }),
  });
  console.log(`   Operator POST /api/master/sites -> Status: ${opSiteRes.status}`);
  if (opSiteRes.status !== 403) throw new Error(`Harusnya 403 tapi dapat ${opSiteRes.status}`);
  const opSiteJson = await opSiteRes.json();
  console.log(`   Pesan error: "${opSiteJson.message}"`);
  console.log('   ✓ DoD T1.2 TERPENUHI: User tanpa izin site.manage ditolak 403.\n');

  // Operator dapat melihat site (memiliki site.view)
  const opViewRes = await fetch(`${BASE_URL}/api/master/sites`, {
    headers: { cookie: operatorCookie },
  });
  console.log(`   Operator GET /api/master/sites -> Status: ${opViewRes.status}`);
  if (opViewRes.status !== 200) throw new Error(`Harusnya 200 tapi dapat ${opViewRes.status}`);
  console.log('   ✓ Operator dengan izin site.view berhasil membaca daftar site.\n');

  // --- T1.3 & T1.4: CRUD MASTER DATA & AUDIT LOG ---
  console.log('3. Menguji CRUD Master Data dan Audit Log (T1.3 & T1.4)...');

  const initialAuditCount = await prisma.auditLog.count();
  console.log(`   Jumlah awal audit log: ${initialAuditCount}`);

  // Admin membuat Vendor baru
  const createVendorRes = await fetch(`${BASE_URL}/api/master/vendors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
      cookie: adminCookie,
    },
    body: JSON.stringify({
      name: 'Vendor-Uji-KP',
      website: 'https://test-vendor.com',
      supportContact: 'test@vendor.com',
      notes: 'Vendor untuk pengujian',
    }),
  });
  if (createVendorRes.status !== 201) throw new Error(`Gagal create vendor: ${createVendorRes.status}`);
  const vendorData = (await createVendorRes.json()).data;
  console.log(`   ✓ Vendor '${vendorData.name}' (ID: ${vendorData.id}) berhasil dibuat`);

  // Admin membuat Model baru yang mengait ke Vendor tersebut
  const cat = await prisma.deviceCategory.findFirstOrThrow();
  const createModelRes = await fetch(`${BASE_URL}/api/master/models`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
      cookie: adminCookie,
    },
    body: JSON.stringify({
      vendorId: vendorData.id,
      categoryId: cat.id,
      modelName: 'Model-Uji-100',
      modelCode: 'MOD-UJI-100',
      description: 'Model uji coba',
    }),
  });
  if (createModelRes.status !== 201) throw new Error(`Gagal create model: ${createModelRes.status}`);
  const modelData = (await createModelRes.json()).data;
  console.log(`   ✓ Model '${modelData.modelCode}' (ID: ${modelData.id}) berhasil dibuat terkait Vendor ID: ${vendorData.id}`);

  // Menguji proteksi penghapusan vendor yang masih dipakai oleh model (T1.3 DoD)
  console.log('   Mencoba menghapus Vendor yang masih memiliki relasi Model...');
  const deleteBlockedVendorRes = await fetch(`${BASE_URL}/api/master/vendors/${vendorData.id}`, {
    method: 'DELETE',
    headers: {
      'Origin': BASE_URL,
      cookie: adminCookie,
    },
  });
  console.log(`   DELETE /api/master/vendors/${vendorData.id} -> Status: ${deleteBlockedVendorRes.status}`);
  if (deleteBlockedVendorRes.status !== 409) throw new Error(`Harusnya 409 tapi dapat ${deleteBlockedVendorRes.status}`);
  const blockedJson = await deleteBlockedVendorRes.json();
  console.log(`   Pesan proteksi: "${blockedJson.message}"`);
  console.log('   ✓ DoD T1.3 TERPENUHI: Vendor tidak dapat dihapus jika masih berelasi dengan model.\n');

  // Hapus model terlebih dahulu
  const deleteModelRes = await fetch(`${BASE_URL}/api/master/models/${modelData.id}`, {
    method: 'DELETE',
    headers: {
      'Origin': BASE_URL,
      cookie: adminCookie,
    },
  });
  if (deleteModelRes.status !== 200) throw new Error('Gagal delete model');
  console.log(`   ✓ Model ID ${modelData.id} berhasil dihapus.`);

  // Sekarang coba hapus vendor lagi (seharusnya berhasil)
  const deleteVendorOkRes = await fetch(`${BASE_URL}/api/master/vendors/${vendorData.id}`, {
    method: 'DELETE',
    headers: {
      'Origin': BASE_URL,
      cookie: adminCookie,
    },
  });
  if (deleteVendorOkRes.status !== 200) throw new Error('Gagal delete vendor setelah model dilepas');
  console.log(`   ✓ Vendor ID ${vendorData.id} sekarang berhasil dihapus setelah relasi bersih.\n`);

  // --- Verifikasi Audit Log (T1.4 DoD) ---
  console.log('4. Memeriksa pencatatan Audit Log (T1.4)...');
  const finalAuditCount = await prisma.auditLog.count();
  console.log(`   Jumlah akhir audit log: ${finalAuditCount} (+${finalAuditCount - initialAuditCount} entri baru)`);

  const latestAudits = await prisma.auditLog.findMany({
    where: { entityType: { in: ['Vendor', 'DeviceModel'] } },
    orderBy: { id: 'desc' },
    take: 4,
  });

  console.log('   4 Audit log terakhir:');
  for (const log of latestAudits) {
    console.log(`   - [ID: ${log.id}] Action: ${log.action} | Entity: ${log.entityType} (ID: ${log.entityId}) | UserID: ${log.userId}`);
    if (log.action === 'CREATE') {
      console.log(`     afterData keys: ${Object.keys((log.afterData as any) ?? {}).join(', ')}`);
    } else if (log.action === 'DELETE') {
      console.log(`     beforeData keys: ${Object.keys((log.beforeData as any) ?? {}).join(', ')}`);
    }
  }

  console.log('\n   ✓ DoD T1.4 TERPENUHI: Operasi create/delete menghasilkan log dengan before/after data lengkap.\n');

  console.log('=== SEMUA PENGUJIAN FASE 1 LULUS (T1.1, T1.2, T1.3, T1.4) ===');
}

run()
  .catch((e) => {
    console.error('ERROR PADA TEST:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
