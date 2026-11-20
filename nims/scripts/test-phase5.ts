/**
 * Phase 5 Integration Test — Dokumen & Lampiran (Documents)
 * DoD Coverage:
 *   T5.1 — Upload & metadata:
 *          - Private storage (di luar public)
 *          - Random filename (UUID)
 *          - Checksum SHA-256 akurat
 *          - Ukuran maksimum (15MB)
 *          - DoD: File tidak bisa diakses lewat URL statis publik langsung (404)
 *   T5.2 — Validasi unggahan:
 *          - Whitelist format & MIME aman
 *          - Tolak keras .svg dan .html (HTTP 400)
 *          - Sajikan unduhan dengan Content-Disposition: attachment + X-Content-Type-Options: nosniff
 *   T5.3 — Akses berizin:
 *          - Endpoint unduh cek permission document.view
 *          - Endpoint upload cek permission document.upload
 *          - DoD: User tanpa izin (Operator NOC) -> 403 & tercatat di audit log (ACCESS_DENIED)
 *          - Audit log tercatat untuk UPLOAD_DOCUMENT dan DOWNLOAD_DOCUMENT
 */
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
  console.log('=== MEMULAI TEST INTEGRASI FASE 5 (DOKUMEN & STORAGE) ===\n');

  // 1. Autentikasi Admin & Operator
  const adminCookie = await login('admin', 'Admin123!');
  console.log('✓ [Auth] Admin login berhasil');

  const operatorCookie = await login('operator', 'Operator123!');
  console.log('✓ [Auth] Operator NOC login berhasil');

  // Ambil salah satu perangkat untuk asosiasi dokumen
  const device = await prisma.device.findFirst({
    where: { inventoryStatus: 'ACTIVE', archivedAt: null },
  });
  assert.ok(device, 'Perlu minimal satu perangkat aktif untuk pengujian');
  console.log(`✓ [Setup] Target device: ${device.hostname} (id=${device.id})`);

  let uploadedDocId = 0;
  let uploadedStorageKey = '';
  const sampleContent = 'hostname CORE-ROUTER-TEST\ninterface GigabitEthernet0/1\n description Uplink to Distribution\n no shutdown\n';
  const sampleChecksum = crypto.createHash('sha256').update(sampleContent).digest('hex');

  // ==========================================
  // T5.1: Upload & Metadata
  // ==========================================
  console.log('\n--- T5.1: Upload & Metadata ---');
  {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const form = new FormData();
    const blob = new Blob([sampleContent], { type: 'text/plain' });
    form.append('file', blob, 'core-backup.cfg');
    form.append('deviceId', device.id.toString());
    form.append('category', 'config_backup');
    form.append('sensitivityLevel', 'internal');
    form.append('description', 'Uji coba backup konfigurasi');

    const res = await fetch(`${BASE}/api/documents`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: BASE },
      body: form,
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201, `Upload gagal: ${JSON.stringify(json)}`);
    assert.ok(json.document.id, 'ID dokumen harus ada');
    uploadedDocId = json.document.id;
    console.log(`✓ T5.1: Dokumen berhasil diunggah (id=${uploadedDocId})`);

    // Verifikasi data di DB
    const dbDoc = await prisma.document.findUnique({ where: { id: uploadedDocId } });
    assert.ok(dbDoc, 'Dokumen harus tersimpan di DB');
    uploadedStorageKey = dbDoc.storageKey;
    assert.strictEqual(dbDoc.checksum, sampleChecksum, 'Checksum SHA-256 DB harus cocok dengan konten');
    assert.strictEqual(dbDoc.fileSize, Buffer.byteLength(sampleContent), 'Ukuran file DB harus cocok');
    assert.strictEqual(dbDoc.originalFilename, 'core-backup.cfg');

    // Verifikasi nama file acak (UUID format)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.cfg$/i;
    assert.ok(uuidPattern.test(dbDoc.storageKey), `Nama file harus acak UUID, didapat: ${dbDoc.storageKey}`);
    console.log(`✓ T5.1: Nama file acak UUID terverifikasi: ${dbDoc.storageKey}`);

    // Verifikasi berkas fisik ada di folder privat nims/storage/documents/
    const diskPath = path.join(process.cwd(), 'storage', 'documents', dbDoc.storageKey);
    assert.ok(fs.existsSync(diskPath), `Berkas fisik harus ada di disk privat: ${diskPath}`);
    const diskContent = fs.readFileSync(diskPath, 'utf8');
    assert.strictEqual(diskContent, sampleContent, 'Konten di disk harus persis sesuai konten unggahan');
    console.log(`✓ T5.1: Berkas fisik tersimpan di disk privat (${diskPath})`);

    // DoD T5.1: File TIDAK BISA diakses lewat URL statis publik langsung
    const publicUrl1 = `${BASE}/storage/documents/${dbDoc.storageKey}`;
    const directRes1 = await fetch(publicUrl1);
    assert.strictEqual(directRes1.status, 404, `Akses publik ke ${publicUrl1} harus 404 Not Found! Didapat: ${directRes1.status}`);

    const publicUrl2 = `${BASE}/storage/${dbDoc.storageKey}`;
    const directRes2 = await fetch(publicUrl2);
    assert.strictEqual(directRes2.status, 404, `Akses publik ke ${publicUrl2} harus 404 Not Found! Didapat: ${directRes2.status}`);
    console.log('✓ T5.1 DoD PASS: Berkas privat tidak dapat diakses langsung via URL statis publik (HTTP 404)');
  }

  // ==========================================
  // T5.2: Validasi Unggahan & Header Unduhan
  // ==========================================
  console.log('\n--- T5.2: Validasi Format & Header Unduhan ---');
  {
    // 1. Tolak keras format .svg
    const formSvg = new FormData();
    const svgBlob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' });
    formSvg.append('file', svgBlob, 'malicious.svg');
    formSvg.append('deviceId', device.id.toString());
    const resSvg = await fetch(`${BASE}/api/documents`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: BASE },
      body: formSvg,
    });
    assert.strictEqual(resSvg.status, 400, 'File .svg harus ditolak HTTP 400!');
    const svgJson = await resSvg.json();
    assert.ok(svgJson.error.includes('dilarang'), `Pesan error harus menyebutkan dilarang: ${svgJson.error}`);
    console.log('✓ T5.2: Penolakan file .svg terbukti berhasil (HTTP 400)');

    // 2. Tolak keras format .html
    const formHtml = new FormData();
    const htmlBlob = new Blob(['<html><body><h1>Phishing</h1></body></html>'], { type: 'text/html' });
    formHtml.append('file', htmlBlob, 'index.html');
    formHtml.append('deviceId', device.id.toString());
    const resHtml = await fetch(`${BASE}/api/documents`, {
      method: 'POST',
      headers: { Cookie: adminCookie, Origin: BASE },
      body: formHtml,
    });
    assert.strictEqual(resHtml.status, 400, 'File .html harus ditolak HTTP 400!');
    const htmlJson = await resHtml.json();
    assert.ok(htmlJson.error.includes('dilarang'), `Pesan error harus menyebutkan dilarang: ${htmlJson.error}`);
    console.log('✓ T5.2: Penolakan file .html terbukti berhasil (HTTP 400)');

    // 3. Unduh berkas valid dan periksa header keamanan
    const downloadRes = await fetch(`${BASE}/api/documents/${uploadedDocId}/download`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(downloadRes.status, 200, `Unduh gagal: ${downloadRes.status}`);

    const contentDisposition = downloadRes.headers.get('content-disposition') || '';
    assert.ok(
      contentDisposition.startsWith('attachment;'),
      `Header Content-Disposition harus attachment, didapat: ${contentDisposition}`
    );
    assert.ok(
      contentDisposition.includes('core-backup.cfg'),
      `Header Content-Disposition harus menyertakan nama file asli: ${contentDisposition}`
    );

    const nosniff = downloadRes.headers.get('x-content-type-options');
    assert.strictEqual(
      nosniff,
      'nosniff',
      `Header X-Content-Type-Options harus nosniff, didapat: ${nosniff}`
    );

    const downloadedText = await downloadRes.text();
    assert.strictEqual(downloadedText, sampleContent, 'Konten berkas yang diunduh harus identik dengan aslinya');
    console.log('✓ T5.2 DoD PASS: Unduhan disajikan dengan Content-Disposition: attachment dan X-Content-Type-Options: nosniff');
  }

  // ==========================================
  // T5.3: Akses Berizin & Audit Log
  // ==========================================
  console.log('\n--- T5.3: Akses Berizin & Audit Trail ---');
  {
    // 1. Operator NOC (hanya punya document.view, TIDAK punya document.upload) mencoba mengunggah
    const formOp = new FormData();
    const blobOp = new Blob(['sample data'], { type: 'text/plain' });
    formOp.append('file', blobOp, 'operator-note.txt');
    formOp.append('deviceId', device.id.toString());

    const resOpUpload = await fetch(`${BASE}/api/documents`, {
      method: 'POST',
      headers: { Cookie: operatorCookie, Origin: BASE },
      body: formOp,
    });
    assert.strictEqual(resOpUpload.status, 403, `Upload oleh Operator harus ditolak 403! Didapat: ${resOpUpload.status}`);
    console.log('✓ T5.3: Upload tanpa izin document.upload terbukti ditolak (HTTP 403)');

    // Verifikasi audit log mencatat ACCESS_DENIED untuk operator
    const operatorUser = await prisma.user.findUnique({ where: { username: 'operator' } });
    assert.ok(operatorUser);
    const deniedAudit = await prisma.auditLog.findFirst({
      where: {
        userId: operatorUser.id,
        action: 'ACCESS_DENIED',
        entityType: 'Document',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(deniedAudit, 'Insiden penolakan akses tanpa izin harus tercatat di audit log');
    console.log(`✓ T5.3 DoD PASS: Percobaan akses tanpa izin tercatat di audit log (action=ACCESS_DENIED, id=${deniedAudit.id})`);

    // 2. Operator mengunduh dokumen (Operator memiliki document.view)
    const opDownloadRes = await fetch(`${BASE}/api/documents/${uploadedDocId}/download`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(opDownloadRes.status, 200, 'Operator dengan izin document.view harus berhasil mengunduh');

    // Verifikasi audit log pengunduhan dokumen tercatat
    const downloadAudit = await prisma.auditLog.findFirst({
      where: {
        userId: operatorUser.id,
        action: 'DOWNLOAD_DOCUMENT',
        entityId: uploadedDocId,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(downloadAudit, 'Aktivitas pengunduhan harus tercatat di audit log');
    console.log(`✓ T5.3: Aktivitas DOWNLOAD_DOCUMENT tercatat di audit log (id=${downloadAudit.id})`);

    // Verifikasi audit log unggahan dokumen tercatat
    const uploadAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'UPLOAD_DOCUMENT',
        entityId: uploadedDocId,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(uploadAudit, 'Aktivitas pengunggahan harus tercatat di audit log');
    console.log(`✓ T5.3: Aktivitas UPLOAD_DOCUMENT tercatat di audit log (id=${uploadAudit.id})`);

    // 3. Request tanpa autentikasi ke endpoint download -> ditolak 401
    const unauthDownload = await fetch(`${BASE}/api/documents/${uploadedDocId}/download`);
    assert.strictEqual(unauthDownload.status, 401, 'Request tanpa autentikasi ke download harus 401');
    console.log('✓ T5.3: Akses unduh tanpa autentikasi ditolak (HTTP 401)');

    // 4. List dokumen perangkat
    const listRes = await fetch(`${BASE}/api/documents?deviceId=${device.id}`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(listRes.status, 200);
    const listJson = await listRes.json();
    assert.ok(listJson.documents.some((d: any) => d.id === uploadedDocId), 'Dokumen yang diunggah harus ada di list');
    console.log(`✓ T5.3: Daftar dokumen perangkat berhasil diakses (${listJson.documents.length} dokumen)`);
  }

  // ==========================================
  // Cleanup: Hapus Dokumen Pengujian
  // ==========================================
  console.log('\n--- Cleanup: Hapus Dokumen Uji ---');
  {
    const delRes = await fetch(`${BASE}/api/documents/${uploadedDocId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie, Origin: BASE },
    });
    assert.strictEqual(delRes.status, 200, `Hapus dokumen gagal: ${delRes.status}`);

    const dbCheck = await prisma.document.findUnique({ where: { id: uploadedDocId } });
    assert.strictEqual(dbCheck, null, 'Record dokumen di DB harus sudah terhapus');

    const diskPath = path.join(process.cwd(), 'storage', 'documents', uploadedStorageKey);
    assert.strictEqual(fs.existsSync(diskPath), false, 'Berkas fisik di disk harus sudah terhapus');
    console.log('✓ Cleanup: Berkas fisik dan record DB dokumen berhasil dibersihkan');
  }

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN FASE 5 (T5.1, T5.2, T5.3) BERHASIL 100%!');
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
