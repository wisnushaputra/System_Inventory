/**
 * Phase 8 Integration Test — Impor CSV Perangkat (Minggu 10–11, P1)
 *
 * DoD Coverage:
 *   T8.1 — Template CSV perangkat + validasi kolom/tipe + preview + laporan error per baris.
 *          DoD: File 10 baris dengan 2 error → 8 tersimpan, 2 dilaporkan dengan nomor baris.
 *   T8.2 — Catat hasil impor — user, waktu, jumlah sukses/gagal.
 *          DoD: Audit log memuat action='IMPORT', entityType='Device', successCount=8, failedCount=2, totalCount=10.
 *   RBAC — Pengguna tanpa izin device.create (Operator NOC) ditolak HTTP 403 & dicatat ACCESS_DENIED.
 */
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(res.status, 200, `Login ${username} gagal: ${await res.text()}`);
  const setCookie = res.headers.get('set-cookie') || '';
  return setCookie.split(';')[0];
}

async function runTests() {
  console.log('=== MEMULAI TEST INTEGRASI FASE 8 (IMPOR CSV PERANGKAT) ===\n');

  // Bersihkan data tes sebelumnya jika ada
  await prisma.device.deleteMany({
    where: { deviceCode: { startsWith: 'TEST-IMP-' } },
  });

  // 1. Autentikasi
  const adminCookie = await login('admin', 'Admin123!');
  console.log('✓ [Auth] Admin login berhasil');

  const operatorCookie = await login('operator', 'Operator123!');
  console.log('✓ [Auth] Operator NOC login berhasil');

  // Pastikan ada site 'POP-BDG-01'
  const site = await prisma.site.findFirst({
    where: { siteCode: 'POP-BDG-01' },
  });
  assert.ok(site, 'Site POP-BDG-01 harus terdaftar di seed');

  // =========================================================================
  // TEST 1: Unduh Template CSV (T8.1)
  // =========================================================================
  console.log('\n--- Test 1: Unduh Template CSV Perangkat ---');
  const templateRes = await fetch(`${BASE}/api/import/devices/template`, {
    headers: { Cookie: adminCookie },
  });
  assert.strictEqual(templateRes.status, 200, 'Gagal mengunduh template CSV');
  assert.ok(
    (templateRes.headers.get('content-type') || '').includes('text/csv'),
    'Content-Type harus text/csv'
  );
  assert.ok(
    (templateRes.headers.get('content-disposition') || '').includes('template-impor-perangkat.csv'),
    'Content-Disposition harus memuat nama file template-impor-perangkat.csv'
  );
  assert.strictEqual(
    templateRes.headers.get('x-content-type-options'),
    'nosniff',
    'X-Content-Type-Options harus nosniff'
  );

  const templateBuffer = await templateRes.arrayBuffer();
  const templateBytes = new Uint8Array(templateBuffer);
  // Periksa UTF-8 BOM [0xEF, 0xBB, 0xBF]
  assert.strictEqual(templateBytes[0], 0xef, 'Byte 0 bukan BOM EF');
  assert.strictEqual(templateBytes[1], 0xbb, 'Byte 1 bukan BOM BB');
  assert.strictEqual(templateBytes[2], 0xbf, 'Byte 2 bukan BOM BF');

  const templateText = new TextDecoder('utf-8').decode(templateBuffer);
  assert.ok(
    templateText.includes('device_code,hostname,category,vendor,model,serial_number,management_ip,site_code,network_role,inventory_status,description'),
    'Header template CSV tidak sesuai standar'
  );
  console.log('✓ Test 1 lolos: Endpoint template menyajikan CSV standar dengan UTF-8 BOM dan header nosniff.');

  // =========================================================================
  // TEST 2: Validasi & Preview (T8.1 DoD: 10 baris dengan 2 error)
  // =========================================================================
  console.log('\n--- Test 2: Validasi & Pratinjau CSV (10 baris, 2 error) ---');

  // Baris 1: Header
  // Baris 2 (Data 1): Valid (Router MikroTik)
  // Baris 3 (Data 2): Valid (Switch Cisco)
  // Baris 4 (Data 3): Valid (OLT Huawei)
  // Baris 5 (Data 4): ERROR 1 -> Kategori fiktif 'kategori-ngawur-999'
  // Baris 6 (Data 5): Valid (Server Cisco)
  // Baris 7 (Data 6): Valid (Firewall Cisco)
  // Baris 8 (Data 7): ERROR 2 -> Site fiktif 'SITE-GAIB-404'
  // Baris 9 (Data 8): Valid (Radio MikroTik)
  // Baris 10 (Data 9): Valid (Other Juniper)
  // Baris 11 (Data 10): Valid (Switch Juniper)
  const csv10RowsWith2Errors =
    `device_code,hostname,category,vendor,model,serial_number,management_ip,site_code,network_role,inventory_status,description\r\n` +
    `TEST-IMP-001,RTR-BDG-01,router,MikroTik,CCR2004,SN-IMP-001,10.99.1.1,POP-BDG-01,core,active,Router Core Valid\r\n` +
    `TEST-IMP-002,SW-BDG-01,switch,Cisco,Catalyst-2960,SN-IMP-002,10.99.1.2,POP-BDG-01,distribution,active,Switch Dist Valid\r\n` +
    `TEST-IMP-003,OLT-BDG-01,olt,Huawei,MA5800,SN-IMP-003,10.99.1.3,POP-BDG-01,access,active,OLT Valid\r\n` +
    `TEST-IMP-004,ERR-CAT-01,kategori-ngawur-999,Cisco,Model-X,SN-IMP-004,10.99.1.4,POP-BDG-01,access,active,Baris Error 1 Kategori Ngawur\r\n` +
    `TEST-IMP-005,SRV-BDG-01,server,Cisco,UCS-C220,SN-IMP-005,10.99.1.5,POP-BDG-01,server,active,Server Valid\r\n` +
    `TEST-IMP-006,FW-BDG-01,firewall,Cisco,ASA-5506,SN-IMP-006,10.99.1.6,POP-BDG-01,core,active,Firewall Valid\r\n` +
    `TEST-IMP-007,ERR-SITE-01,switch,Cisco,Catalyst-2960,SN-IMP-007,10.99.1.7,SITE-GAIB-404,access,active,Baris Error 2 Site Gaib\r\n` +
    `TEST-IMP-008,RAD-BDG-01,radio,MikroTik,NetMetal,SN-IMP-008,10.99.1.8,POP-BDG-01,access,active,Radio Valid\r\n` +
    `TEST-IMP-009,OTH-BDG-01,other,Juniper,EX4300,SN-IMP-009,10.99.1.9,POP-BDG-01,other,active,Perangkat Lain Valid\r\n` +
    `TEST-IMP-010,SW-BDG-02,switch,Juniper,EX2300,SN-IMP-010,10.99.1.10,POP-BDG-01,access,active,Switch Access Valid\r\n`;

  const previewRes = await fetch(`${BASE}/api/import/devices/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE },
    body: JSON.stringify({ csvText: csv10RowsWith2Errors }),
  });

  const previewText = await previewRes.text();
  assert.strictEqual(previewRes.status, 200, `Preview gagal: ${previewText}`);
  const previewData = JSON.parse(previewText);

  assert.strictEqual(previewData.totalRows, 10, 'Total baris harus 10');
  assert.strictEqual(previewData.validCount, 8, 'Valid count harus tepat 8');
  assert.strictEqual(previewData.invalidCount, 2, 'Invalid count harus tepat 2');
  assert.strictEqual(previewData.errors.length, 2, 'Jumlah error harus tepat 2');

  // Verifikasi nomor baris fisik file CSV pada laporan error
  const errRowNums = previewData.errors.map((e: any) => e.rowNumber);
  assert.ok(errRowNums.includes(5), 'Error baris 5 (kategori fiktif) tidak ditemukan');
  assert.ok(errRowNums.includes(8), 'Error baris 8 (site fiktif) tidak ditemukan');
  console.log('✓ Test 2 lolos: Preview berhasil memvalidasi 10 baris -> 8 valid, 2 error dilaporkan tepat di baris 5 dan 8.');

  // =========================================================================
  // TEST 3: Eksekusi Impor Parsial (T8.1 DoD: 8 tersimpan, 2 dilaporkan)
  // =========================================================================
  console.log('\n--- Test 3: Eksekusi Impor Parsial ---');
  const executeRes = await fetch(`${BASE}/api/import/devices/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE },
    body: JSON.stringify({ csvText: csv10RowsWith2Errors }),
  });

  const executeText = await executeRes.text();
  assert.strictEqual(executeRes.status, 200, `Execute gagal: ${executeText}`);
  const executeData = JSON.parse(executeText);

  assert.strictEqual(executeData.totalRows, 10, 'Total baris harus 10');
  assert.strictEqual(executeData.successCount, 8, 'Success count harus tepat 8');
  assert.strictEqual(executeData.failedCount, 2, 'Failed count harus tepat 2');
  assert.strictEqual(executeData.errors.length, 2, 'Laporan error harus ada 2');

  const execErrRows = executeData.errors.map((e: any) => e.rowNumber);
  assert.ok(execErrRows.includes(5), 'Laporan eksekusi baris 5 tidak ditemukan');
  assert.ok(execErrRows.includes(8), 'Laporan eksekusi baris 8 tidak ditemukan');

  // Verifikasi ke database: tepat 8 perangkat tersimpan
  const dbSavedCount = await prisma.device.count({
    where: { deviceCode: { startsWith: 'TEST-IMP-' } },
  });
  assert.strictEqual(dbSavedCount, 8, `Harus tepat 8 perangkat di DB, ditemukan: ${dbSavedCount}`);

  // Pastikan perangkat yang error TIDAK tersimpan di DB
  const errDevice4 = await prisma.device.findUnique({ where: { deviceCode: 'TEST-IMP-004' } });
  const errDevice7 = await prisma.device.findUnique({ where: { deviceCode: 'TEST-IMP-007' } });
  assert.strictEqual(errDevice4, null, 'TEST-IMP-004 tidak boleh ada di DB');
  assert.strictEqual(errDevice7, null, 'TEST-IMP-007 tidak boleh ada di DB');

  // Pastikan perangkat valid tersimpan lengkap dengan management IP-nya
  const validDevice1 = await prisma.device.findUnique({
    where: { deviceCode: 'TEST-IMP-001' },
    include: { ipAddresses: true, category: true, vendor: true },
  });
  assert.ok(validDevice1, 'TEST-IMP-001 harus ada di DB');
  assert.strictEqual(validDevice1.hostname, 'RTR-BDG-01');
  assert.strictEqual(validDevice1.category.code, 'router');
  assert.strictEqual(validDevice1.vendor.name, 'MikroTik');
  assert.strictEqual(validDevice1.ipAddresses[0]?.address, '10.99.1.1');
  console.log('✓ Test 3 lolos: DoD T8.1 terpenuhi penuh: tepat 8 perangkat tersimpan di DB, 2 baris error ditolak dan dilaporkan.');

  // =========================================================================
  // TEST 4: Audit Log Pencatatan Impor (T8.2 DoD)
  // =========================================================================
  console.log('\n--- Test 4: Verifikasi Audit Log Hasil Impor (T8.2) ---');
  const importAudit = await prisma.auditLog.findFirst({
    where: { action: 'IMPORT', entityType: 'Device' },
    orderBy: { id: 'desc' },
    include: { user: true },
  });

  assert.ok(importAudit, 'Audit log dengan action IMPORT tidak ditemukan');
  assert.strictEqual(importAudit.user?.username, 'admin', 'Audit log harus mencatat user admin');
  assert.ok(importAudit.createdAt instanceof Date, 'Audit log harus mencatat waktu');

  const afterData = importAudit.afterData as any;
  assert.strictEqual(afterData.totalRows, 10, 'Audit log totalRows harus 10');
  assert.strictEqual(afterData.successCount, 8, 'Audit log successCount harus 8');
  assert.strictEqual(afterData.failedCount, 2, 'Audit log failedCount harus 2');
  assert.ok(Array.isArray(afterData.errors), 'Audit log harus memuat detail errors');
  assert.strictEqual(afterData.errors.length, 2, 'Audit log errors harus berjumlah 2');
  console.log('✓ Test 4 lolos: DoD T8.2 terpenuhi: audit log mencatat user admin, waktu, successCount=8, failedCount=2.');

  // =========================================================================
  // TEST 5: RBAC Enforcement
  // =========================================================================
  console.log('\n--- Test 5: RBAC Enforcement (Operator NOC Tanpa device.create) ---');

  // Preview ditolak 403
  const opPreviewRes = await fetch(`${BASE}/api/import/devices/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: operatorCookie, Origin: BASE },
    body: JSON.stringify({ csvText: csv10RowsWith2Errors }),
  });
  assert.strictEqual(opPreviewRes.status, 403, 'Operator NOC harus ditolak 403 pada preview');

  // Execute ditolak 403
  const opExecuteRes = await fetch(`${BASE}/api/import/devices/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: operatorCookie, Origin: BASE },
    body: JSON.stringify({ csvText: csv10RowsWith2Errors }),
  });
  assert.strictEqual(opExecuteRes.status, 403, 'Operator NOC harus ditolak 403 pada execute');

  // Cek pencatatan ACCESS_DENIED di audit log
  const deniedAudit = await prisma.auditLog.findFirst({
    where: { action: 'ACCESS_DENIED' },
    orderBy: { id: 'desc' },
    include: { user: true },
  });
  assert.ok(deniedAudit, 'Insiden penolakan akses harus tercatat di audit log');
  assert.strictEqual(deniedAudit.user?.username, 'operator', 'Audit log penolakan harus mencatat user operator');
  console.log('✓ Test 5 lolos: RBAC enforced: Operator NOC ditolak HTTP 403 dan dicatat ACCESS_DENIED di audit log.');

  // =========================================================================
  // CLEANUP
  // =========================================================================
  console.log('\n--- Cleanup Data Uji ---');
  await prisma.ipAddress.deleteMany({
    where: { address: { startsWith: '10.99.1.' } },
  });
  await prisma.device.deleteMany({
    where: { deviceCode: { startsWith: 'TEST-IMP-' } },
  });
  console.log('✓ Cleanup selesai: data uji bersih.');

  console.log('\n============================================================');
  console.log('🎉 SEMUA PENGUJIAN FASE 8 (T8.1 & T8.2) LOLOS DENGAN SUKSES!');
  console.log('============================================================\n');
}

runTests()
  .catch((err) => {
    console.error('❌ Test Fase 8 Gagal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
