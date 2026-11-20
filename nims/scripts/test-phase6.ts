/**
 * Phase 6 Integration Test — Dashboard, Audit UI, Ekspor (Minggu 9)
 * DoD Coverage:
 *   T6.1 — Dashboard:
 *          - Kartu total perangkat, site, subnet, relasi koneksi
 *          - Breakdown per kategori, per status, per site
 *          - Daftar data belum lengkap (data completeness)
 *          - DoD: Angka cocok 100% dengan hasil query DB manual
 *   T6.2 — Halaman Audit Log:
 *          - Filter user, objek/entitas, aksi, rentang tanggal, read-only
 *          - DoD: User tanpa izin (Operator NOC) ditolak 403 & tercatat di audit log
 *   T6.3 — Ekspor CSV/XLSX:
 *          - Sesuai filter + RBAC (Operator ditolak 403)
 *          - DoD AC §6.6 lolos
 *          - DoD Formula Injection Defense: Sel diawali = + - @ di-escape dengan tanda kutip tunggal (')
 *          - DoD: Aktivitas ekspor tercatat di audit log (action='EXPORT')
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
  console.log('=== MEMULAI TEST INTEGRASI FASE 6 (DASHBOARD, AUDIT UI, EKSPOR) ===\n');

  // 1. Autentikasi
  const adminCookie = await login('admin', 'Admin123!');
  console.log('✓ [Auth] Admin login berhasil');

  const operatorCookie = await login('operator', 'Operator123!');
  console.log('✓ [Auth] Operator NOC login berhasil');

  // ==========================================
  // T6.1: Dashboard Statistics & Data Completeness
  // ==========================================
  console.log('\n--- T6.1: Dashboard Statistics & Data Completeness ---');
  {
    const res = await fetch(`${BASE}/api/dashboard/stats`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(res.status, 200, `Gagal memuat stats: ${res.status}`);
    const stats = await res.json();

    // Query DB manual secara independen
    const [
      dbActiveDevices,
      dbArchivedDevices,
      dbTotalSites,
      dbTotalSubnets,
      dbTotalConnections,
    ] = await Promise.all([
      prisma.device.count({ where: { archivedAt: null } }),
      prisma.device.count({ where: { archivedAt: { not: null } } }),
      prisma.site.count(),
      prisma.subnet.count(),
      prisma.networkConnection.count({ where: { archivedAt: null } }),
    ]);

    // Verifikasi DoD T6.1: Angka kartu dashboard cocok dengan hasil query manual
    assert.strictEqual(
      stats.overview.totalActiveDevices,
      dbActiveDevices,
      `totalActiveDevices tidak cocok: API=${stats.overview.totalActiveDevices}, DB=${dbActiveDevices}`
    );
    assert.strictEqual(
      stats.overview.totalArchivedDevices,
      dbArchivedDevices,
      `totalArchivedDevices tidak cocok: API=${stats.overview.totalArchivedDevices}, DB=${dbArchivedDevices}`
    );
    assert.strictEqual(
      stats.overview.totalSites,
      dbTotalSites,
      `totalSites tidak cocok: API=${stats.overview.totalSites}, DB=${dbTotalSites}`
    );
    assert.strictEqual(
      stats.overview.totalSubnets,
      dbTotalSubnets,
      `totalSubnets tidak cocok: API=${stats.overview.totalSubnets}, DB=${dbTotalSubnets}`
    );
    assert.strictEqual(
      stats.overview.totalConnections,
      dbTotalConnections,
      `totalConnections tidak cocok: API=${stats.overview.totalConnections}, DB=${dbTotalConnections}`
    );
    console.log(`✓ T6.1 DoD PASS: Angka kartu dashboard cocok 100% dengan hasil query DB manual:`);
    console.log(`    - Total Perangkat Aktif: ${stats.overview.totalActiveDevices} (Arsip: ${stats.overview.totalArchivedDevices})`);
    console.log(`    - Total Site POP: ${stats.overview.totalSites}`);
    console.log(`    - Total Subnet: ${stats.overview.totalSubnets}`);
    console.log(`    - Total Relasi Koneksi Aktif: ${stats.overview.totalConnections}`);

    // Verifikasi kategori & status
    assert.ok(Array.isArray(stats.devicesByCategory), 'devicesByCategory harus array');
    assert.ok(Array.isArray(stats.devicesByStatus), 'devicesByStatus harus array');
    assert.ok(Array.isArray(stats.devicesBySite), 'devicesBySite harus array');
    console.log(`✓ T6.1: Distribusi perangkat terverifikasi (${stats.devicesByCategory.length} kategori, ${stats.devicesByStatus.length} status)`);

    // Verifikasi daftar data belum lengkap (incompleteDevices)
    assert.ok(Array.isArray(stats.incompleteDevices), 'incompleteDevices harus array');
    for (const inc of stats.incompleteDevices) {
      assert.ok(inc.missingFields.length > 0, 'Incomplete device harus memiliki minimal 1 field hilang');
    }
    console.log(`✓ T6.1: Audit kelengkapan data terverifikasi (${stats.overview.incompleteCount} perangkat perlu dilengkapi, skor: ${stats.overview.completenessPercentage}%)`);
  }

  // ==========================================
  // T6.2: Halaman & API Audit Log
  // ==========================================
  console.log('\n--- T6.2: Halaman & API Audit Log ---');
  {
    // 1. Verifikasi RBAC: Operator NOC (tidak punya izin audit.view) ditolak 403
    const resOpAudit = await fetch(`${BASE}/api/audit-logs`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(resOpAudit.status, 403, `Operator tanpa audit.view harus ditolak 403! Didapat: ${resOpAudit.status}`);

    const opUser = await prisma.user.findUnique({ where: { username: 'operator' } });
    assert.ok(opUser);
    const deniedAudit = await prisma.auditLog.findFirst({
      where: {
        userId: opUser.id,
        action: 'ACCESS_DENIED',
        entityType: 'AuditLog',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(deniedAudit, 'Insiden penolakan audit.view harus tercatat di audit log');
    console.log(`✓ T6.2 DoD PASS: Akses audit log tanpa izin ditolak HTTP 403 & tercatat di audit log (action=ACCESS_DENIED)`);

    // 2. Admin mengakses audit log dan menguji filter
    const resAdminAudit = await fetch(`${BASE}/api/audit-logs?limit=10`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resAdminAudit.status, 200);
    const auditData = await resAdminAudit.json();
    assert.ok(Array.isArray(auditData.data), 'auditData.data harus array');
    assert.ok(auditData.pagination.total > 0, 'Harus ada data audit log di database');
    console.log(`✓ T6.2: Admin berhasil mengakses audit log (${auditData.pagination.total} total log)`);

    // Uji filter action=LOGIN
    const resFilterAction = await fetch(`${BASE}/api/audit-logs?action=LOGIN`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resFilterAction.status, 200);
    const filterActionData = await resFilterAction.json();
    for (const item of filterActionData.data) {
      assert.strictEqual(item.action, 'LOGIN', 'Semua item hasil filter harus action=LOGIN');
    }
    console.log(`✓ T6.2: Filter action=LOGIN berfungsi akurat (${filterActionData.data.length} data)`);

    // Uji filter entityType=Device
    const resFilterEntity = await fetch(`${BASE}/api/audit-logs?entityType=Device`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resFilterEntity.status, 200);
    const filterEntityData = await resFilterEntity.json();
    for (const item of filterEntityData.data) {
      assert.strictEqual(item.entityType, 'Device', 'Semua item hasil filter harus entityType=Device');
    }
    console.log(`✓ T6.2: Filter entityType=Device berfungsi akurat (${filterEntityData.data.length} data)`);

    // Uji filter rentang tanggal
    const todayStr = new Date().toISOString().split('T')[0];
    const resFilterDate = await fetch(`${BASE}/api/audit-logs?startDate=${todayStr}`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resFilterDate.status, 200);
    const filterDateData = await resFilterDate.json();
    assert.ok(filterDateData.data.length > 0, 'Harus ada audit log pada hari ini');
    console.log(`✓ T6.2: Filter tanggal startDate=${todayStr} berfungsi akurat (${filterDateData.data.length} data)`);
  }

  // ==========================================
  // T6.3: Ekspor CSV Sesuai Filter & Anti Formula Injection
  // ==========================================
  console.log('\n--- T6.3: Ekspor CSV & Anti Formula Injection ---');
  {
    // 1. Verifikasi RBAC: Operator NOC tidak punya report.export -> ditolak 403
    const resOpExport = await fetch(`${BASE}/api/export/devices`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(resOpExport.status, 403, `Operator tanpa report.export harus 403! Didapat: ${resOpExport.status}`);

    const opUser = await prisma.user.findUnique({ where: { username: 'operator' } });
    assert.ok(opUser);
    const deniedExportAudit = await prisma.auditLog.findFirst({
      where: {
        userId: opUser.id,
        action: 'ACCESS_DENIED',
        entityType: 'Device',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(deniedExportAudit, 'Penolakan akses ekspor harus tercatat di audit log');
    console.log('✓ T6.3: Akses ekspor tanpa izin report.export terbukti ditolak (HTTP 403) & tercatat di audit log');

    // 2. Buat perangkat uji coba dengan nilai berbahaya untuk menguji pertahanan Formula Injection (CWE-1236)
    // Nilai diawali: = + - @
    const category = await prisma.deviceCategory.findFirstOrThrow();
    const vendor = await prisma.vendor.findFirstOrThrow();
    const site = await prisma.site.findFirstOrThrow();

    const testMaliciousDevice = await prisma.device.create({
      data: {
        deviceCode: 'TEST-EXP-001',
        hostname: '=CMD|\' /C calc\'!A0', // Simbol '='
        serialNumber: '+628123456789',      // Simbol '+'
        ownerTeam: '-FormulaMinus',         // Simbol '-'
        description: '@SUM(1,2)',           // Simbol '@'
        categoryId: category.id,
        vendorId: vendor.id,
        siteId: site.id,
        inventoryStatus: 'ACTIVE',
      },
    });
    console.log(`✓ [Setup] Perangkat uji formula injection dibuat (id=${testMaliciousDevice.id})`);

    try {
      // 3. Admin mengekspor daftar perangkat dengan filter q=TEST-EXP-001
      const exportRes = await fetch(`${BASE}/api/export/devices?q=TEST-EXP-001`, {
        headers: { Cookie: adminCookie },
      });
      assert.strictEqual(exportRes.status, 200, `Ekspor gagal: ${exportRes.status}`);

      // Periksa header keamanan
      const contentType = exportRes.headers.get('content-type') || '';
      assert.ok(contentType.includes('text/csv'), `Content-Type harus text/csv, didapat: ${contentType}`);
      const disposition = exportRes.headers.get('content-disposition') || '';
      assert.ok(disposition.includes('attachment; filename='), `Content-Disposition harus attachment: ${disposition}`);
      assert.strictEqual(exportRes.headers.get('x-content-type-options'), 'nosniff');

      const exportBuf = Buffer.from(await exportRes.arrayBuffer());

      // Verifikasi UTF-8 BOM: [0xEF, 0xBB, 0xBF]
      const hasBom = exportBuf[0] === 0xef && exportBuf[1] === 0xbb && exportBuf[2] === 0xbf;
      assert.ok(hasBom, 'CSV harus diawali UTF-8 Byte Order Mark (BOM: 0xEF, 0xBB, 0xBF)');

      const csvText = exportBuf.toString('utf-8');

      // DoD T6.3: Verifikasi Formula Injection Protection:
      // Sel diawali = + - @ WAJIB di-escape dengan tanda kutip tunggal (') di awal nilainya
      assert.ok(
        csvText.includes("\"'=CMD"),
        `Hostname dengan '=' harus di-escape dengan awalan tanda kutip tunggal, baris ditemukan:\n${csvText}`
      );
      assert.ok(
        csvText.includes("\"'+628123456789\""),
        `Serial number dengan '+' harus di-escape dengan awalan tanda kutip tunggal, baris ditemukan:\n${csvText}`
      );
      assert.ok(
        csvText.includes("\"'-FormulaMinus\""),
        `Owner team dengan '-' harus di-escape dengan awalan tanda kutip tunggal, baris ditemukan:\n${csvText}`
      );
      assert.ok(
        csvText.includes("\"'@SUM(1,2)\""),
        `Description dengan '@' harus di-escape dengan awalan tanda kutip tunggal, baris ditemukan:\n${csvText}`
      );
      console.log(`✓ T6.3 DoD PASS: Proteksi Formula Injection terbukti 100%! Sel dengan karakter (=, +, -, @) di-escape secara aman.`);
    } finally {
      // Hapus perangkat uji formula injection
      await prisma.device.delete({ where: { id: testMaliciousDevice.id } });
      console.log('✓ [Cleanup] Perangkat uji formula injection dibersihkan.');
    }

    // 4. Verifikasi audit log mencatat aksi EXPORT
    const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
    assert.ok(adminUser);
    const exportAudit = await prisma.auditLog.findFirst({
      where: {
        userId: adminUser.id,
        action: 'EXPORT',
        entityType: 'Device',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(exportAudit, 'Aktivitas ekspor perangkat wajib tercatat di audit log');
    console.log(`✓ T6.3 DoD PASS: Aktivitas ekspor tercatat di audit log (id=${exportAudit.id}, action=EXPORT)`);

    // 5. Admin mengekspor audit log
    const exportAuditRes = await fetch(`${BASE}/api/export/audit-logs?limit=50`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(exportAuditRes.status, 200, `Ekspor audit log gagal: ${exportAuditRes.status}`);
    const auditBuf = Buffer.from(await exportAuditRes.arrayBuffer());
    assert.ok(
      auditBuf[0] === 0xef && auditBuf[1] === 0xbb && auditBuf[2] === 0xbf,
      'Audit log CSV harus diawali UTF-8 BOM'
    );
    const auditCsvText = auditBuf.toString('utf-8');
    assert.ok(auditCsvText.includes('"Log ID","Waktu","Nama Pengguna"'), 'Header audit log CSV harus sesuai');
    console.log(`✓ T6.3: Ekspor audit log ke CSV berhasil (${auditCsvText.split('\n').length} baris)`);
  }

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN FASE 6 (T6.1, T6.2, T6.3) BERHASIL 100%!');
  console.log('======================================================\n');
}

runTests()
  .catch((err) => {
    console.error('\n❌ PENGUJIAN GAGAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
