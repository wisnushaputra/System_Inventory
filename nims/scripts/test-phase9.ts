/**
 * Phase 9 Integration Test — Hardening, Uji Keamanan, & Optimistic Locking (T9.1 & T9.2)
 *
 * DoD Coverage:
 *   T9.1 — Uji keamanan:
 *          - Rate limit login: percobaan gagal > 5 kali menghasilkan HTTP 429 Too Many Requests
 *          - CSRF / Origin: request POST dari origin fiktif ditolak HTTP 403
 *          - HTTP Security Headers: X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy
 *          - Backup & Restore rehearsal: data terbukti dapat dibackup dan diverifikasi integritasnya
 *   T9.2 — Optimistic locking pada edit perangkat & relasi:
 *          - Tab/pengguna A dan B membuka data yang sama (versi 1)
 *          - Tab B melakukan update lebih dulu (versi naik ke 2)
 *          - Tab A mengirim update dengan versi 1 lama -> Ditolak HTTP 409 Conflict (Lost update dicegah!)
 *          - Tab A refresh & kirim versi 2 terbaru -> Berhasil (versi naik ke 3)
 */
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';
import { resetRateLimit } from '../src/lib/rate-limit';
import { createDatabaseBackup, verifyAndRestoreRehearsal } from './rehearsal-backup-restore';
import fs from 'node:fs/promises';

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
  console.log('=== MEMULAI TEST INTEGRASI FASE 9 (HARDENING & OPTIMISTIC LOCKING) ===\n');

  // Bersihkan rate limit sebelum uji
  resetRateLimit('login:127.0.0.1');

  // =========================================================================
  // TEST 1: Rate Limiting Percobaan Login (T9.1)
  // =========================================================================
  console.log('--- Test 1: Rate Limiting Percobaan Login (Maksimal 5x gagal) ---');
  const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE,
        'x-forwarded-for': testIp,
      },
      body: JSON.stringify({ username: 'admin', password: 'salah-password-123' }),
    });
    assert.strictEqual(res.status, 401, `Percobaan ${i} harus 401`);
  }

  // Percobaan ke-6 harus diblokir oleh rate limiter (HTTP 429)
  const blockedRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE,
      'x-forwarded-for': testIp,
    },
    body: JSON.stringify({ username: 'admin', password: 'salah-password-123' }),
  });
  assert.strictEqual(blockedRes.status, 429, `Percobaan ke-6 harus 429 Too Many Requests, didapat: ${blockedRes.status}`);
  const retryHeader = blockedRes.headers.get('retry-after');
  assert.ok(retryHeader, 'Header Retry-After harus disertakan');
  console.log(`✓ Test 1 lolos: Percobaan login gagal ke-6 diblokir dengan HTTP 429 (Retry-After: ${retryHeader} detik).`);

  // Login normal sebagai Admin (IP default)
  const adminCookie = await login('admin', 'Admin123!');
  console.log('✓ Login normal admin berhasil');

  // =========================================================================
  // TEST 2: CSRF / Origin Protection (T9.1)
  // =========================================================================
  console.log('\n--- Test 2: Proteksi CSRF & Origin Validation ---');
  const evilOriginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://evil-attacker.com' },
    body: JSON.stringify({ username: 'admin', password: 'Admin123!' }),
  });
  assert.strictEqual(evilOriginRes.status, 403, 'Permintaan dengan origin asing harus ditolak HTTP 403');
  console.log('✓ Test 2 lolos: Permintaan dari origin ilegal (CSRF) ditolak HTTP 403.');

  // =========================================================================
  // TEST 3: HTTP Security Headers (T9.1)
  // =========================================================================
  console.log('\n--- Test 3: HTTP Security Headers (Clickjacking & Nosniff) ---');
  const pageRes = await fetch(`${BASE}/login`);
  const frameOptions = pageRes.headers.get('x-frame-options');
  const contentTypeOptions = pageRes.headers.get('x-content-type-options');
  const referrerPolicy = pageRes.headers.get('referrer-policy');

  assert.strictEqual(frameOptions, 'DENY', 'X-Frame-Options harus DENY');
  assert.strictEqual(contentTypeOptions, 'nosniff', 'X-Content-Type-Options harus nosniff');
  assert.strictEqual(referrerPolicy, 'strict-origin-when-cross-origin', 'Referrer-Policy harus strict-origin-when-cross-origin');
  console.log('✓ Test 3 lolos: HTTP security headers aktif (X-Frame-Options: DENY, X-Content-Type-Options: nosniff).');

  // =========================================================================
  // TEST 4: Database Backup & Restore Rehearsal (T9.1)
  // =========================================================================
  console.log('\n--- Test 4: Database Backup & Restore Rehearsal ---');
  const backupPath = await createDatabaseBackup();
  const restoreOk = await verifyAndRestoreRehearsal(backupPath);
  assert.ok(restoreOk, 'Restore rehearsal harus berhasil');
  await fs.unlink(backupPath);
  console.log('✓ Test 4 lolos: Prosedur backup dan pemulihan data (rehearsal) terverifikasi 100% tanpa inkonsistensi.');

  // =========================================================================
  // TEST 5: Optimistic Locking pada Edit Perangkat (T9.2)
  // =========================================================================
  console.log('\n--- Test 5: Optimistic Locking pada Edit Perangkat (Cegah Lost Update) ---');

  // Buat perangkat uji
  const testDev = await prisma.device.create({
    data: {
      deviceCode: 'TEST-LOCK-001',
      hostname: 'test-lock-001.isp.net',
      categoryId: (await prisma.deviceCategory.findFirstOrThrow()).id,
      vendorId: (await prisma.vendor.findFirstOrThrow()).id,
      siteId: (await prisma.site.findFirstOrThrow()).id,
      inventoryStatus: 'ACTIVE',
      version: 1,
    },
  });

  try {
    // Skenario Dua Pengguna/Tab:
    // Pengguna A dan Pengguna B membaca data perangkat bersamaan (versi 1)
    const clientAVersion = testDev.version; // 1
    const clientBVersion = testDev.version; // 1

    // 1. Pengguna B menyimpan perubahan lebih dulu (update hostname -> 'rtr-updated-by-user-b')
    const updateBRes = await fetch(`${BASE}/api/devices/${testDev.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE },
      body: JSON.stringify({
        hostname: 'rtr-updated-by-user-b.net',
        version: clientBVersion, // 1
      }),
    });
    assert.strictEqual(updateBRes.status, 200, 'Update Pengguna B harus berhasil');
    const updateBData = await updateBRes.json();
    assert.strictEqual(updateBData.data.version, 2, 'Versi perangkat harus naik menjadi 2');
    console.log(`✓ Pengguna B berhasil mengupdate data -> Versi perangkat sekarang: ${updateBData.data.version}`);

    // 2. Pengguna A mencoba menyimpan data form lamanya (masih versi 1)
    const updateARes = await fetch(`${BASE}/api/devices/${testDev.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE },
      body: JSON.stringify({
        hostname: 'rtr-overwritten-by-user-a.net',
        version: clientAVersion, // 1 (kadaluarsa!)
      }),
    });

    // Harus DITOLAK dengan status HTTP 409 Conflict (Optimistic Locking aktif)
    assert.strictEqual(
      updateARes.status,
      409,
      `Update Pengguna A dengan versi usang harus ditolak HTTP 409! Didapat: ${updateARes.status}`
    );
    const conflictData = await updateARes.json();
    assert.strictEqual(conflictData.code, 'CONFLICT_OPTIMISTIC_LOCK');
    console.log(`✓ DoD T9.2 Lolos: Lost update dicegah! Pengguna A ditolak HTTP 409: "${conflictData.message}"`);

    // Pastikan data di database TIDAK tertimpa oleh Pengguna A
    const currentInDb = await prisma.device.findUniqueOrThrow({ where: { id: testDev.id } });
    assert.strictEqual(
      currentInDb.hostname,
      'rtr-updated-by-user-b.net',
      'Data pengguna B tidak boleh tertimpa'
    );
    assert.strictEqual(currentInDb.version, 2);

    // 3. Pengguna A memuat ulang (refresh) dan menyimpan dengan versi 2 terbaru
    const freshUpdateRes = await fetch(`${BASE}/api/devices/${testDev.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE },
      body: JSON.stringify({
        hostname: 'rtr-resolved-by-user-a.net',
        version: currentInDb.version, // 2
      }),
    });
    assert.strictEqual(freshUpdateRes.status, 200);
    const freshData = await freshUpdateRes.json();
    assert.strictEqual(freshData.data.version, 3);
    console.log(`✓ Pengguna A berhasil menyimpan setelah refresh versi terbaru (Versi sekarang: 3).`);
  } finally {
    await prisma.device.delete({ where: { id: testDev.id } });
  }

  // =========================================================================
  // TEST 6: Optimistic Locking pada Edit Relasi Jaringan (T9.2)
  // =========================================================================
  console.log('\n--- Test 6: Optimistic Locking pada Edit Relasi Jaringan ---');
  const conn = await prisma.networkConnection.findFirst({
    where: { archivedAt: null },
  });

  if (conn) {
    const connVersion = conn.version;

    // Update pertama (sukses, versi naik)
    const resB = await fetch(`${BASE}/api/connections/${conn.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE },
      body: JSON.stringify({
        description: 'Update oleh user B',
        version: connVersion,
      }),
    });
    assert.strictEqual(resB.status, 200);

    // Update kedua dengan versi usang (harus ditolak 409)
    const resA = await fetch(`${BASE}/api/connections/${conn.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE },
      body: JSON.stringify({
        description: 'Update basi oleh user A',
        version: connVersion, // Versi usang
      }),
    });
    assert.strictEqual(resA.status, 409, 'Koneksi dengan versi usang harus ditolak 409');
    const connConflict = await resA.json();
    assert.strictEqual(connConflict.code, 'CONFLICT_OPTIMISTIC_LOCK');
    console.log(`✓ DoD T9.2 Lolos: Optimistic locking pada koneksi relasi berhasil menolak pembaruan usang.`);
  }

  console.log('\n============================================================');
  console.log('🎉 SEMUA PENGUJIAN FASE 9 (T9.1 & T9.2) BERHASIL 100%!');
  console.log('============================================================\n');
}

runTests()
  .catch((err) => {
    console.error('❌ Test Fase 9 Gagal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
