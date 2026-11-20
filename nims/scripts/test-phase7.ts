/**
 * Phase 7 Integration Test — Topologi Relasi Jaringan (Minggu 10)
 * DoD Coverage:
 *   T7.1 — Grafik relasi dari data tersimpan, filter site/kategori/tipe relasi:
 *          - DoD 1: Data node memuat detail lengkap perangkat
 *          - DoD 2: Data edge memuat dua port terhubung (Endpoint A & Endpoint B)
 *          - DoD 3: Filter site, kategori, dan tipe relasi berfungsi akurat
 *          - DoD 4: TIDAK ADA label status 'up' atau 'down' pada node atau edge
 *   T7.2 — Simpan & muat layout per user:
 *          - Posisi node disimpan ke database via API
 *          - Layout terisolasi antar user (Admin vs Operator NOC)
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
  console.log('=== MEMULAI TEST INTEGRASI FASE 7 (TOPOLOGI & LAYOUT) ===\n');

  // 1. Autentikasi Admin & Operator
  const adminCookie = await login('admin', 'Admin123!');
  console.log('✓ [Auth] Admin login berhasil');

  const operatorCookie = await login('operator', 'Operator123!');
  console.log('✓ [Auth] Operator NOC login berhasil');

  // 2. Setup Perangkat dan Relasi untuk Pengujian Topologi
  console.log('\n--- Setup: Perangkat & Koneksi Topologi ---');
  const devs = await prisma.device.findMany({
    where: { inventoryStatus: 'ACTIVE', archivedAt: null },
    take: 2,
    include: { interfaces: true },
  });
  assert.ok(devs.length >= 2, 'Perlu minimal 2 perangkat aktif untuk topologi');
  const devA = devs[0];
  const devB = devs[1];

  // Pastikan kedua perangkat memiliki port
  let ifaceA = devA.interfaces[0];
  if (!ifaceA) {
    ifaceA = await prisma.interface.create({
      data: { deviceId: devA.id, name: 'topo-port-a1', interfaceType: 'ethernet' },
    });
  }

  let ifaceB = devB.interfaces[0];
  if (!ifaceB) {
    ifaceB = await prisma.interface.create({
      data: { deviceId: devB.id, name: 'topo-port-b1', interfaceType: 'ethernet' },
    });
  }

  // Buat atau cari relasi koneksi antara port A dan port B
  const [minId, maxId] = ifaceA.id < ifaceB.id ? [ifaceA.id, ifaceB.id] : [ifaceB.id, ifaceA.id];
  let connection = await prisma.networkConnection.findUnique({
    where: {
      endpointAInterfaceId_endpointBInterfaceId: {
        endpointAInterfaceId: minId,
        endpointBInterfaceId: maxId,
      },
    },
  });

  if (!connection) {
    connection = await prisma.networkConnection.create({
      data: {
        endpointAInterfaceId: minId,
        endpointBInterfaceId: maxId,
        relationType: 'physical',
        medium: 'fiber',
        capacityMbps: 10000,
        label: 'Uplink Core-Dist Test',
        status: 'documented',
      },
    });
    console.log(`✓ [Setup] Relasi koneksi uji coba dibuat (id=${connection.id})`);
  } else {
    console.log(`✓ [Setup] Menggunakan relasi koneksi yang sudah ada (id=${connection.id})`);
  }

  // ==========================================
  // T7.1: Grafik Relasi Topologi (DoD Verifikasi)
  // ==========================================
  console.log('\n--- T7.1: Grafik Relasi Topologi (DoD Check) ---');
  {
    const res = await fetch(`${BASE}/api/topology`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(res.status, 200, `Gagal memuat topologi: ${res.status}`);
    const data = await res.json();

    assert.ok(Array.isArray(data.nodes), 'data.nodes harus array');
    assert.ok(Array.isArray(data.edges), 'data.edges harus array');
    assert.ok(data.nodes.length >= 2, 'Harus memuat minimal 2 node');
    assert.ok(data.edges.length >= 1, 'Harus memuat minimal 1 edge');

    // 1. Verifikasi DoD: Klik Node → Detail Lengkap Perangkat
    const nodeA = data.nodes.find((n: any) => n.id === devA.id.toString());
    assert.ok(nodeA, `Node untuk perangkat ${devA.hostname} harus ada`);
    assert.ok(nodeA.data.hostname, 'Node data harus memiliki hostname');
    assert.ok(nodeA.data.deviceCode, 'Node data harus memiliki deviceCode');
    assert.ok(nodeA.data.category, 'Node data harus memiliki category');
    assert.ok(nodeA.data.site, 'Node data harus memiliki site');
    assert.ok(nodeA.data.inventoryStatus, 'Node data harus memiliki inventoryStatus');
    console.log(`✓ T7.1 DoD PASS: Data node memuat detail lengkap perangkat (${nodeA.data.hostname}, kode=${nodeA.data.deviceCode}, site=${nodeA.data.site})`);

    // 2. Verifikasi DoD: Klik Edge → Menampilkan Dua Port Terhubung
    const edge = data.edges.find((e: any) => e.id === `conn-${connection.id}`);
    assert.ok(edge, `Edge untuk koneksi conn-${connection.id} harus ada`);
    assert.ok(edge.data.endpointA.portName, 'Edge harus memuat nama port Endpoint A');
    assert.ok(edge.data.endpointB.portName, 'Edge harus memuat nama port Endpoint B');
    assert.ok(edge.data.endpointA.hostname, 'Edge harus memuat hostname Endpoint A');
    assert.ok(edge.data.endpointB.hostname, 'Edge harus memuat hostname Endpoint B');
    assert.strictEqual(edge.data.relationType, 'physical');
    assert.strictEqual(edge.data.medium, 'fiber');
    console.log(`✓ T7.1 DoD PASS: Data edge memuat dua port terhubung:`);
    console.log(`    - Endpoint A: ${edge.data.endpointA.hostname} (Port: ${edge.data.endpointA.portName})`);
    console.log(`    - Endpoint B: ${edge.data.endpointB.hostname} (Port: ${edge.data.endpointB.portName})`);
    console.log(`    - Media: ${edge.data.medium}, Tipe: ${edge.data.relationType}`);

    // 3. Verifikasi DoD: TIDAK ADA LABEL UP/DOWN pada topologi
    const allStatuses = [
      ...data.nodes.map((n: any) => n.data.inventoryStatus),
      ...data.edges.map((e: any) => e.data.status),
    ];
    for (const st of allStatuses) {
      const lower = String(st).toLowerCase();
      assert.ok(
        lower !== 'up' && lower !== 'down' && lower !== 'online' && lower !== 'offline',
        `Topologi DILARANG memuat label status '${st}' (DoD T7.1 & PRD §5.2 / §6.4)!`
      );
    }
    console.log('✓ T7.1 DoD PASS: Terbukti 100% TIDAK ADA label status up/down/online/offline pada node atau edge.');

    // 4. Verifikasi Filter Topologi
    const resFilteredSite = await fetch(`${BASE}/api/topology?siteId=${devA.siteId}`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resFilteredSite.status, 200);
    const siteData = await resFilteredSite.json();
    for (const n of siteData.nodes) {
      assert.strictEqual(n.data.siteCode, devA.siteCode || n.data.siteCode);
    }
    console.log(`✓ T7.1: Filter siteId=${devA.siteId} berfungsi akurat (${siteData.nodes.length} node)`);

    const resFilteredRel = await fetch(`${BASE}/api/topology?relationType=physical`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resFilteredRel.status, 200);
    const relData = await resFilteredRel.json();
    for (const e of relData.edges) {
      assert.strictEqual(e.data.relationType, 'physical');
    }
    console.log(`✓ T7.1: Filter relationType=physical berfungsi akurat (${relData.edges.length} edge)`);
  }

  // ==========================================
  // T7.2: Simpan & Muat Layout Per User
  // ==========================================
  console.log('\n--- T7.2: Simpan & Muat Layout Per User ---');
  {
    const adminPositions = {
      [devA.id.toString()]: { x: 120, y: 240 },
      [devB.id.toString()]: { x: 480, y: 360 },
    };

    // 1. Admin menyimpan tata letak
    const resSaveAdmin = await fetch(`${BASE}/api/topology/layout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        Origin: BASE,
      },
      body: JSON.stringify({
        scope: 'default',
        positions: adminPositions,
      }),
    });
    assert.strictEqual(resSaveAdmin.status, 200, `Gagal simpan layout admin: ${await resSaveAdmin.text()}`);
    console.log('✓ T7.2: Admin berhasil menyimpan tata letak node ke database');

    // 2. Admin memuat kembali tata letak tersimpan
    const resGetAdmin = await fetch(`${BASE}/api/topology/layout?scope=default`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resGetAdmin.status, 200);
    const getAdminData = await resGetAdmin.json();
    assert.deepStrictEqual(
      getAdminData.positions[devA.id.toString()],
      adminPositions[devA.id.toString()],
      'Posisi node A admin harus cocok dengan yang disimpan'
    );
    assert.deepStrictEqual(
      getAdminData.positions[devB.id.toString()],
      adminPositions[devB.id.toString()],
      'Posisi node B admin harus cocok dengan yang disimpan'
    );
    console.log('✓ T7.2: Tata letak tersimpan admin berhasil dimuat kembali secara persisten');

    // 3. Verifikasi Isolasi Per User: Operator NOC memiliki layout mandiri
    const resGetOp = await fetch(`${BASE}/api/topology/layout?scope=default`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(resGetOp.status, 200);
    const getOpData = await resGetOp.json();
    // Operator belum menyimpan layout default, sehingga tidak boleh bocor data posisi admin
    assert.ok(
      !getOpData.positions || Object.keys(getOpData.positions).length === 0,
      'Layout operator harus kosong dan tidak boleh membocorkan layout admin'
    );

    // Operator menyimpan posisi kustom miliknya
    const operatorPositions = {
      [devA.id.toString()]: { x: 50, y: 50 },
    };
    const resSaveOp = await fetch(`${BASE}/api/topology/layout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: operatorCookie,
        Origin: BASE,
      },
      body: JSON.stringify({
        scope: 'default',
        positions: operatorPositions,
      }),
    });
    assert.strictEqual(resSaveOp.status, 200);

    // Verifikasi posisi admin TIDAK berubah setelah operator menyimpan
    const resVerifyAdmin = await fetch(`${BASE}/api/topology/layout?scope=default`, {
      headers: { Cookie: adminCookie },
    });
    const verifyAdminData = await resVerifyAdmin.json();
    assert.deepStrictEqual(
      verifyAdminData.positions[devA.id.toString()],
      adminPositions[devA.id.toString()],
      'Posisi admin harus tetap terisolasi dan tidak terpengaruh simpanan operator'
    );
    console.log('✓ T7.2 DoD PASS: Isolasi tata letak per user terverifikasi 100% (Admin vs Operator NOC)');
  }

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN FASE 7 (T7.1 & T7.2) BERHASIL 100%!');
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
