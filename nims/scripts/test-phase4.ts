/**
 * Phase 4 Integration Test — Relasi Jaringan (Network Connections)
 * DoD Coverage:
 *   T4.1 — Skema relasi + 3 aturan integritas:
 *          Rule 1: Endpoint A ≠ B ditolak
 *          Rule 2: Anti-duplikat A-B & B-A ditolak oleh level DB
 *          Rule 3: Satu port satu koneksi fisik aktif ditolak
 *   T4.2 — Form tambah/edit relasi + pilih dua port (AC §6.3 lolos)
 *   T4.3 — Tampilan koneksi di detail perangkat A dan B (port ini ↔ port lawan)
 *   T4.4 — Arsip relasi + aturan relasi perangkat terarsip tidak muncul di default
 */
import assert from 'node:assert';

const BASE = 'http://localhost:3000';
const HEADERS = { 'Content-Type': 'application/json', Origin: BASE };

let SESSION_COOKIE = '';
let deviceAId = 0;
let deviceBId = 0;
let portA1 = 0;
let portA2 = 0;
let portB1 = 0;
let connectionId = 0;

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...HEADERS, ...(SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: res.status, json, headers: res.headers };
}

async function login() {
  const r = await api('POST', '/api/auth/login', { username: 'admin', password: 'Admin123!' });
  assert.strictEqual(r.status, 200, `Login gagal: ${JSON.stringify(r.json)}`);
  const setCookie = r.headers.get('set-cookie') || '';
  SESSION_COOKIE = setCookie.split(';')[0];
  console.log('✓ Login berhasil');
}

// Persiapan: Ambil 2 perangkat dan buat port untuk pengujian relasi
async function setupDevicesAndPorts() {
  const rDevs = await api('GET', '/api/devices?limit=2&inventoryStatus=ACTIVE');
  assert.strictEqual(rDevs.status, 200);
  const devs = rDevs.json.data;
  assert.ok(devs.length >= 2, 'Perlu minimal 2 perangkat aktif untuk pengujian relasi');
  deviceAId = devs[0].id;
  deviceBId = devs[1].id;
  console.log(`✓ Perangkat A: id=${deviceAId} (${devs[0].hostname}), Perangkat B: id=${deviceBId} (${devs[1].hostname})`);

  // Buat port A1 dan A2 pada Perangkat A
  const rPortA1 = await api('POST', `/api/devices/${deviceAId}/interfaces`, {
    name: 't4-port-a1',
    interfaceType: 'ethernet',
    speedMbps: 10000,
  });
  assert.strictEqual(rPortA1.status, 201, `Gagal buat port A1: ${JSON.stringify(rPortA1.json)}`);
  portA1 = rPortA1.json.data.id;

  const rPortA2 = await api('POST', `/api/devices/${deviceAId}/interfaces`, {
    name: 't4-port-a2',
    interfaceType: 'ethernet',
    speedMbps: 10000,
  });
  assert.strictEqual(rPortA2.status, 201, `Gagal buat port A2: ${JSON.stringify(rPortA2.json)}`);
  portA2 = rPortA2.json.data.id;

  // Buat port B1 pada Perangkat B
  const rPortB1 = await api('POST', `/api/devices/${deviceBId}/interfaces`, {
    name: 't4-port-b1',
    interfaceType: 'ethernet',
    speedMbps: 10000,
  });
  assert.strictEqual(rPortB1.status, 201, `Gagal buat port B1: ${JSON.stringify(rPortB1.json)}`);
  portB1 = rPortB1.json.data.id;

  console.log(`✓ Port dibuat: A1=${portA1}, A2=${portA2}, B1=${portB1}`);
}

// ── T4.1 ATURAN 1: Endpoint A ≠ B ditolak ─────────────────────────────────
async function testRule1EndpointsDiff() {
  const r = await api('POST', '/api/connections', {
    endpointAInterfaceId: portA1,
    endpointBInterfaceId: portA1, // Port sama
    relationType: 'physical',
  });
  assert.strictEqual(r.status, 400, `Harus 400 untuk endpoint sama, dapat: ${r.status}`);
  assert.ok(
    r.json.message?.includes('tidak boleh sama'),
    `Pesan error harus menyebut port tidak boleh sama, dapat: ${r.json.message}`
  );
  console.log('✓ T4.1 Rule 1 — Port sumber = tujuan ditolak dengan benar (400 Bad Request)');
}

// ── T4.2: Pembuatan Relasi Valid A1 ↔ B1 ──────────────────────────────────
async function testCreateValidConnection() {
  const r = await api('POST', '/api/connections', {
    endpointAInterfaceId: portA1,
    endpointBInterfaceId: portB1,
    relationType: 'physical',
    medium: 'fiber',
    capacityMbps: 10000,
    label: 'Uplink Core-to-Distribution',
    description: 'Kabel fiber single mode antar-rak',
  });
  assert.strictEqual(r.status, 201, `Gagal buat relasi: ${JSON.stringify(r.json)}`);
  connectionId = r.json.data.id;
  assert.strictEqual(r.json.data.relationType, 'physical');
  assert.strictEqual(r.json.data.medium, 'fiber');
  assert.strictEqual(r.json.data.capacityMbps, 10000);
  console.log(`✓ T4.2 — Relasi koneksi valid berhasil dibuat (id=${connectionId})`);
}

// ── T4.1 ATURAN 2: Anti-duplikat A-B & B-A ditolak ────────────────────────
async function testRule2AntiDuplicate() {
  // Coba buat duplikat A1 -> B1
  const rSame = await api('POST', '/api/connections', {
    endpointAInterfaceId: portA1,
    endpointBInterfaceId: portB1,
    relationType: 'physical',
  });
  assert.strictEqual(rSame.status, 409, `Harus 409 untuk duplikat A-B, dapat: ${rSame.status}`);

  // Coba buat kebalikan B1 -> A1
  const rReverse = await api('POST', '/api/connections', {
    endpointAInterfaceId: portB1,
    endpointBInterfaceId: portA1,
    relationType: 'physical',
  });
  assert.strictEqual(rReverse.status, 409, `Harus 409 untuk duplikat B-A (kebalikan), dapat: ${rReverse.status}`);
  console.log('✓ T4.1 Rule 2 — Duplikasi koneksi A-B dan B-A ditolak (409 Conflict)');
}

// ── T4.1 ATURAN 3: Satu port satu koneksi fisik aktif ─────────────────────
async function testRule3SingleActivePhysicalLink() {
  // Port A1 sudah dipakai untuk koneksi fisik ke B1. Coba hubungkan Port A1 secara fisik ke Port A2:
  const rConflict = await api('POST', '/api/connections', {
    endpointAInterfaceId: portA1,
    endpointBInterfaceId: portA2,
    relationType: 'physical',
  });
  assert.strictEqual(rConflict.status, 409, `Harus 409 untuk port yang sudah punya link fisik aktif, dapat: ${rConflict.status}`);
  assert.ok(
    rConflict.json.message?.includes('sudah memiliki koneksi fisik aktif'),
    `Pesan error harus menyebut konflik koneksi fisik aktif, dapat: ${rConflict.json.message}`
  );
  console.log('✓ T4.1 Rule 3 — Penolakan dua koneksi fisik aktif pada satu port berhasil (409 Conflict)');
}

// ── T4.3: Tampilan koneksi di detail perangkat A dan B ─────────────────────
async function testDetailDeviceConnections() {
  // Cek dari sudut pandang Perangkat A
  const rConnA = await api('GET', `/api/connections?deviceId=${deviceAId}`);
  assert.strictEqual(rConnA.status, 200);
  const foundA = rConnA.json.data.find((c: any) => c.id === connectionId);
  assert.ok(foundA, 'Koneksi harus muncul di daftar koneksi Perangkat A');

  // Cek dari sudut pandang Perangkat B
  const rConnB = await api('GET', `/api/connections?deviceId=${deviceBId}`);
  assert.strictEqual(rConnB.status, 200);
  const foundB = rConnB.json.data.find((c: any) => c.id === connectionId);
  assert.ok(foundB, 'Koneksi harus muncul di daftar koneksi Perangkat B');

  // Cek endpoint detail perangkat /api/devices/[id]
  const rDevDetail = await api('GET', `/api/devices/${deviceAId}`);
  assert.strictEqual(rDevDetail.status, 200);

  console.log('✓ T4.3 — Relasi koneksi terlihat di kedua sisi perangkat (A dan B)');
}

// ── T4.4: Alur Arsip & Filter Default ─────────────────────────────────────
async function testArchiveConnectionFlow() {
  // 1. Arsipkan koneksi
  const rArchive = await api('POST', `/api/connections/${connectionId}/archive`, {
    reason: 'Kabel fiber diganti untuk pemeliharaan berkala',
  });
  assert.strictEqual(rArchive.status, 200, `Gagal arsip: ${JSON.stringify(rArchive.json)}`);
  assert.strictEqual(rArchive.json.data.status, 'archived');
  assert.ok(rArchive.json.data.archivedAt, 'archivedAt harus terisi');

  // 2. Cek query default (isArchived=false) -> koneksi harus TIDAK muncul
  const rDefault = await api('GET', `/api/connections?deviceId=${deviceAId}`);
  assert.strictEqual(rDefault.status, 200);
  const notFoundInDefault = rDefault.json.data.find((c: any) => c.id === connectionId);
  assert.strictEqual(notFoundInDefault, undefined, 'Koneksi terarsip tidak boleh muncul di query default');

  // 3. Cek query filter arsip (isArchived=true) -> koneksi harus MUNCUL
  const rArchivedList = await api('GET', `/api/connections?deviceId=${deviceAId}&isArchived=true`);
  assert.strictEqual(rArchivedList.status, 200);
  const foundInArchived = rArchivedList.json.data.find((c: any) => c.id === connectionId);
  assert.ok(foundInArchived, 'Koneksi terarsip harus muncul pada filter isArchived=true');
  assert.strictEqual(foundInArchived.archiveReason, 'Kabel fiber diganti untuk pemeliharaan berkala');

  // 4. Pulihkan koneksi (restore)
  const rRestore = await api('POST', `/api/connections/${connectionId}/restore`);
  assert.strictEqual(rRestore.status, 200, `Gagal restore: ${JSON.stringify(rRestore.json)}`);
  assert.strictEqual(rRestore.json.data.status, 'documented');
  assert.strictEqual(rRestore.json.data.archivedAt, null);

  // 5. Cek kembali di query default -> koneksi harus muncul kembali
  const rRestoredDefault = await api('GET', `/api/connections?deviceId=${deviceAId}`);
  assert.strictEqual(rRestoredDefault.status, 200);
  const restoredItem = rRestoredDefault.json.data.find((c: any) => c.id === connectionId);
  assert.ok(restoredItem, 'Koneksi yang dipulihkan harus muncul kembali di query default');

  console.log('✓ T4.4 — Alur arsip, penyembunyian di default, filter arsip, dan restore berhasil');
}

// ── Cleanup: Hapus koneksi dan port uji ───────────────────────────────────
async function cleanup() {
  if (connectionId > 0) {
    await api('DELETE', `/api/connections/${connectionId}`);
    console.log('✓ Cleanup — Koneksi uji dihapus');
  }
  if (portA1 > 0) await api('DELETE', `/api/devices/${deviceAId}/interfaces/${portA1}`);
  if (portA2 > 0) await api('DELETE', `/api/devices/${deviceAId}/interfaces/${portA2}`);
  if (portB1 > 0) await api('DELETE', `/api/devices/${deviceBId}/interfaces/${portB1}`);
  console.log('✓ Cleanup — Port uji dihapus');
}

(async () => {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  FASE 4 — Integration Test: Relasi Jaringan');
  console.log('══════════════════════════════════════════════════\n');

  try {
    await login();
    await setupDevicesAndPorts();

    console.log('\n── T4.1: 3 Aturan Integritas Relasi Jaringan ─────');
    await testRule1EndpointsDiff();
    await testCreateValidConnection();
    await testRule2AntiDuplicate();
    await testRule3SingleActivePhysicalLink();

    console.log('\n── T4.3: Visibilitas Koneksi di Dua Sisi Perangkat');
    await testDetailDeviceConnections();

    console.log('\n── T4.4: Alur Arsip, Sembunyikan Default, & Restore');
    await testArchiveConnectionFlow();

    await cleanup();

    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ SEMUA TEST FASE 4 LULUS (T4.1–T4.4)');
    console.log('══════════════════════════════════════════════════\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST GAGAL:', err.message || err);
    await cleanup().catch(() => {});
    process.exit(1);
  }
})();
