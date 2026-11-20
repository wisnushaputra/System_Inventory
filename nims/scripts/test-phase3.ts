/**
 * Phase 3 Integration Test — Port & IPAM
 * DoD Coverage:
 *   T3.1 — unique(deviceId, name) di DB menolak duplikat port
 *   T3.2 — CRUD port + batch pattern berhasil
 *   T3.3 — unique(subnetId, address) di DB menolak IP ganda
 *   T3.4 — host IP network/broadcast ditolak; IP valid tersimpan; release -> RELEASED
 *   T3.5 — managementIp muncul dinamis di device query tanpa kolom management_ip di devices
 */
import assert from 'node:assert';

const BASE = 'http://localhost:3000';
const HEADERS = { 'Content-Type': 'application/json', Origin: BASE };

let SESSION_COOKIE = '';
let deviceId = 0;
let subnetId = 0;
let ipId = 0;
let interfaceId = 0;

// ── helpers ────────────────────────────────────────────────────────────────
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

// ── T3.2 Persiapan: dapatkan deviceId valid dari daftar perangkat ──────────
async function getFirstDevice() {
  const r = await api('GET', '/api/devices?limit=1');
  assert.strictEqual(r.status, 200);
  const devices = r.json.data;
  assert.ok(devices.length > 0, 'Harus ada minimal 1 perangkat untuk pengujian (jalankan seeder)');
  deviceId = devices[0].id;
  console.log(`✓ Menggunakan deviceId=${deviceId} (${devices[0].hostname})`);
}

// ── T3.2a: Tambah port single ──────────────────────────────────────────────
async function testAddSinglePort() {
  const r = await api('POST', `/api/devices/${deviceId}/interfaces`, {
    name: 'ether-test-1',
    interfaceType: 'ethernet',
    speedMbps: 1000,
    adminStatus: 'enabled',
  });
  assert.strictEqual(r.status, 201, `Gagal tambah port: ${JSON.stringify(r.json)}`);
  interfaceId = r.json.data.id;
  assert.strictEqual(r.json.data.name, 'ether-test-1');
  console.log(`✓ T3.2a — Port single 'ether-test-1' berhasil dibuat (id=${interfaceId})`);
}

// ── T3.1: DB menolak port duplikat ────────────────────────────────────────
async function testDuplicatePortRejected() {
  const r = await api('POST', `/api/devices/${deviceId}/interfaces`, {
    name: 'ether-test-1',      // nama sama, device sama
    interfaceType: 'ethernet',
  });
  assert.strictEqual(r.status, 409, `Harus 409, dapat: ${r.status} — ${JSON.stringify(r.json)}`);
  console.log('✓ T3.1 — DB menolak port duplikat (409 Conflict)');
}

// ── T3.2b: Batch port berpola ─────────────────────────────────────────────
async function testBatchPort() {
  const r = await api('POST', `/api/devices/${deviceId}/interfaces`, {
    mode: 'batch',
    prefix: 'ether',
    startNumber: 1,
    count: 4,
    interfaceType: 'ethernet',
    speedMbps: 1000,
  });
  assert.strictEqual(r.status, 201, `Gagal batch port: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.data.length, 4, `Harus 4 port, dapat: ${r.json.data.length}`);
  const names = r.json.data.map((p: any) => p.name);
  assert.deepStrictEqual(names, ['ether1', 'ether2', 'ether3', 'ether4']);
  console.log('✓ T3.2b — Batch 4 port berpola (ether1–ether4) berhasil');
}

// ── T3.2c: GET daftar interface ───────────────────────────────────────────
async function testGetInterfaces() {
  const r = await api('GET', `/api/devices/${deviceId}/interfaces`);
  assert.strictEqual(r.status, 200);
  const interfaces = r.json.data;
  assert.ok(Array.isArray(interfaces));
  assert.ok(interfaces.length >= 5, `Harus >= 5 port, dapat: ${interfaces.length}`);
  console.log(`✓ T3.2c — GET interfaces: ${interfaces.length} port terdaftar`);
}

// ── T3.3: Buat subnet & T3.4 validasi CIDR ───────────────────────────────
async function testCreateSubnet() {
  const r = await api('POST', '/api/ipam/subnets', {
    name: 'Test Management',
    cidr: '10.99.0.0/24',
    purpose: 'management',
    status: 'active',
  });
  assert.strictEqual(r.status, 201, `Gagal buat subnet: ${JSON.stringify(r.json)}`);
  subnetId = r.json.data.id;
  assert.ok(subnetId > 0);
  console.log(`✓ T3.3 persiapan — Subnet 10.99.0.0/24 dibuat (id=${subnetId})`);
}

// ── T3.4a: Tolak network address ─────────────────────────────────────────
async function testRejectNetworkAddress() {
  const r = await api('POST', '/api/ipam/addresses', {
    subnetId,
    address: '10.99.0.0',   // Network address
    purpose: 'management',
  });
  assert.strictEqual(r.status, 400, `Harus 400 untuk network address, dapat: ${r.status}`);
  assert.ok(
    r.json.message?.includes('Network Address'),
    `Pesan error harus menyebut 'Network Address', dapat: ${r.json.message}`
  );
  console.log('✓ T3.4a — Network address 10.99.0.0 ditolak dengan benar');
}

// ── T3.4b: Tolak broadcast address ───────────────────────────────────────
async function testRejectBroadcastAddress() {
  const r = await api('POST', '/api/ipam/addresses', {
    subnetId,
    address: '10.99.0.255',   // Broadcast address
    purpose: 'management',
  });
  assert.strictEqual(r.status, 400, `Harus 400 untuk broadcast address, dapat: ${r.status}`);
  assert.ok(
    r.json.message?.includes('Broadcast Address'),
    `Pesan error harus menyebut 'Broadcast Address', dapat: ${r.json.message}`
  );
  console.log('✓ T3.4b — Broadcast address 10.99.0.255 ditolak dengan benar');
}

// ── T3.4c: IP valid tersimpan ─────────────────────────────────────────────
async function testAllocateValidIp() {
  const r = await api('POST', '/api/ipam/addresses', {
    subnetId,
    address: '10.99.0.1',
    deviceId,
    interfaceId,
    purpose: 'management',
    allocationStatus: 'ALLOCATED',
    hostname: 'router-test.local',
  });
  assert.strictEqual(r.status, 201, `Gagal alokasi IP: ${JSON.stringify(r.json)}`);
  ipId = r.json.data.id;
  assert.strictEqual(r.json.data.address, '10.99.0.1');
  assert.strictEqual(r.json.data.allocationStatus, 'ALLOCATED');
  console.log(`✓ T3.4c — IP valid 10.99.0.1 berhasil dialokasikan (id=${ipId})`);
}

// ── T3.3: DB menolak duplikat IP di subnet sama ───────────────────────────
async function testDuplicateIpRejected() {
  const r = await api('POST', '/api/ipam/addresses', {
    subnetId,
    address: '10.99.0.1',   // Sudah ada di subnet yang sama
    purpose: 'loopback',
    allocationStatus: 'ALLOCATED',
  });
  // Sudah ALLOCATED → 409
  assert.strictEqual(r.status, 409, `Harus 409 untuk IP duplikat, dapat: ${r.status}`);
  console.log('✓ T3.3 — IP duplikat di subnet sama ditolak (409 Conflict)');
}

// ── T3.4d: Release IP → status RELEASED ──────────────────────────────────
async function testReleaseIp() {
  const r = await api('POST', `/api/ipam/addresses/${ipId}/release`);
  assert.strictEqual(r.status, 200, `Gagal release IP: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.data.allocationStatus, 'RELEASED');
  assert.ok(r.json.data.releasedAt, 'releasedAt harus terisi');
  assert.strictEqual(r.json.data.deviceId, null, 'deviceId harus null setelah release');
  assert.strictEqual(r.json.data.interfaceId, null, 'interfaceId harus null setelah release');
  console.log('✓ T3.4d — IP dilepas: status=RELEASED, deviceId=null, interfaceId=null');
}

// ── T3.5: Management IP muncul dinamis di device query ───────────────────
async function testManagementIpDynamic() {
  // Alokasikan ulang sebagai management (re-claim RELEASED)
  const rAlloc = await api('POST', '/api/ipam/addresses', {
    subnetId,
    address: '10.99.0.1',
    deviceId,
    purpose: 'management',
    allocationStatus: 'ALLOCATED',
  });
  assert.ok(rAlloc.status === 200 || rAlloc.status === 201,
    `Gagal re-alokasi management IP: ${JSON.stringify(rAlloc.json)}`);

  // Cek managementIp muncul di GET /api/devices (list)
  const rList = await api('GET', `/api/devices?limit=100`);
  assert.strictEqual(rList.status, 200);
  const deviceRow = rList.json.data.find((d: any) => d.id === deviceId);
  assert.ok(deviceRow, 'Device tidak ditemukan di list');
  assert.strictEqual(deviceRow.managementIp, '10.99.0.1',
    `managementIp di list harus '10.99.0.1', dapat: ${deviceRow.managementIp}`);

  // Cek managementIp muncul di GET /api/devices/[id] (detail)
  const rDetail = await api('GET', `/api/devices/${deviceId}`);
  assert.strictEqual(rDetail.status, 200);
  assert.strictEqual(rDetail.json.data.managementIp, '10.99.0.1',
    `managementIp di detail harus '10.99.0.1', dapat: ${rDetail.json.data.managementIp}`);

  // Verifikasi tidak ada kolom management_ip di schema devices (D2)
  const prismaSchema = await (await import('node:fs/promises')).readFile(
    'prisma/schema.prisma', 'utf-8'
  );
  assert.ok(
    !prismaSchema.includes('managementIp') && !prismaSchema.includes('management_ip'),
    'PELANGGARAN D2: kolom managementIp/management_ip tidak boleh ada di model Device!'
  );

  console.log('✓ T3.5 — managementIp=10.99.0.1 muncul dinamis di list & detail tanpa kolom di Device schema');
}

// ── T3.2d: DELETE port ───────────────────────────────────────────────────
async function testDeletePort() {
  const r = await api('DELETE', `/api/devices/${deviceId}/interfaces/${interfaceId}`);
  assert.strictEqual(r.status, 200, `Gagal hapus port: ${JSON.stringify(r.json)}`);
  console.log(`✓ T3.2d — Port id=${interfaceId} berhasil dihapus`);
}

// ── Cleanup: hapus subnet (memerlukan release semua IP dulu) ──────────────
async function cleanup() {
  // Release IP jika masih ALLOCATED
  const rIps = await api('GET', `/api/ipam/addresses?subnetId=${subnetId}`);
  if (rIps.status === 200) {
    for (const ip of rIps.json.data) {
      if (ip.allocationStatus === 'ALLOCATED') {
        await api('POST', `/api/ipam/addresses/${ip.id}/release`);
      }
    }
  }

  // Hapus subnet
  const rDel = await api('DELETE', `/api/ipam/subnets/${subnetId}`);
  if (rDel.status === 200) {
    console.log('✓ Cleanup — Subnet test berhasil dihapus');
  }

  // Hapus port batch ether1-ether4 (ether-test-1 sudah dihapus di T3.2d)
  const rIfaces = await api('GET', `/api/devices/${deviceId}/interfaces`);
  if (rIfaces.status === 200) {
    for (const iface of rIfaces.json.data) {
      if (['ether1','ether2','ether3','ether4','ether-test-1'].includes(iface.name)) {
        await api('DELETE', `/api/devices/${deviceId}/interfaces/${iface.id}`);
      }
    }
    console.log('✓ Cleanup — Port test dihapus');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n════════════════════════════════════════');
  console.log('  FASE 3 — Integration Test: Port & IPAM');
  console.log('════════════════════════════════════════\n');

  try {
    await login();
    await getFirstDevice();

    console.log('\n── T3.2 & T3.1: Interface (Port) ─────');
    await testAddSinglePort();
    await testDuplicatePortRejected();
    await testBatchPort();
    await testGetInterfaces();

    console.log('\n── T3.3 & T3.4: Subnet & IPAM ────────');
    await testCreateSubnet();
    await testRejectNetworkAddress();
    await testRejectBroadcastAddress();
    await testAllocateValidIp();
    await testDuplicateIpRejected();
    await testReleaseIp();

    console.log('\n── T3.5: Management IP Dinamis ────────');
    await testManagementIpDynamic();

    console.log('\n── T3.2d: Delete Port ─────────────────');
    await testDeletePort();

    await cleanup();

    console.log('\n════════════════════════════════════════');
    console.log('  ✅ SEMUA TEST FASE 3 LULUS (T3.1–T3.5)');
    console.log('════════════════════════════════════════\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST GAGAL:', err.message || err);
    await cleanup().catch(() => {});
    process.exit(1);
  }
})();
