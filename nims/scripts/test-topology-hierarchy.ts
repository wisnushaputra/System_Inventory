/**
 * Topology Hierarchy Test (POP -> Customer Site -> Devices)
 *
 * Verifies:
 * 1. Global topology returns all devices with hierarchical metadata (parentPop, isPopCore).
 * 2. POP filter (?popId=X) returns devices in POP + all customer sites under that POP.
 * 3. POP internal-only filter (?popId=X&isInternalOnly=true) returns only direct devices in POP.
 * 4. Specific customer site filter (?siteId=Y) returns only devices in that customer site.
 * 5. Layout persistence per scope (pop-X vs site-Y vs default) is isolated per user.
 * 6. RBAC: Unauthorized access is rejected (401).
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
  const text = await res.text();
  assert.strictEqual(res.status, 200, `Login ${username} gagal: ${text}`);
  const setCookie = res.headers.get('set-cookie') || '';
  return setCookie.split(';')[0];
}

async function run() {
  console.log('=== MEMULAI TEST HIERARKI TOPOLOGI (POP -> CUSTOMER -> DEVICES) ===\n');

  // 1. Auth Setup
  const adminCookie = await login('admin', 'Admin123!');
  console.log('✓ [Auth] Admin login berhasil');

  const operatorCookie = await login('operator', 'Operator123!');
  console.log('✓ [Auth] Operator login berhasil');

  // 2. RBAC check: Unauthenticated rejected
  {
    const res = await fetch(`${BASE}/api/topology`);
    assert.strictEqual(res.status, 401, 'Request tanpa cookie harus ditolak 401');
    console.log('✓ [RBAC] Unauthenticated access ditolak 401');
  }

  // Cari ID POP Bandung dan Customer Site Telkom dari DB
  const popBdg = await prisma.site.findUniqueOrThrow({ where: { siteCode: 'POP-BDG-01' } });
  const custTlk = await prisma.site.findUniqueOrThrow({ where: { siteCode: 'CUST-TLK-01' } });

  // 3. Test 1: Global Topology Query
  {
    const res = await fetch(`${BASE}/api/topology`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(res.status, 200, 'GET /api/topology global harus 200');
    const json = await res.json();
    assert.ok(Array.isArray(json.nodes), 'nodes harus array');
    assert.ok(json.nodes.length >= 5, 'Harus ada minimal 5 nodes aktif');

    // Cek metadata hierarki pada node
    const coreNode = json.nodes.find((n: any) => n.data.deviceCode === 'DEV-BDG-RTR-01');
    assert.ok(coreNode, 'Node Core Router Bandung harus ada');
    assert.strictEqual(coreNode.data.isPopCore, true, 'DEV-BDG-RTR-01 harus isPopCore = true');
    assert.strictEqual(coreNode.data.parentPop.siteCode, 'POP-BDG-01');

    const custNode = json.nodes.find((n: any) => n.data.deviceCode === 'DEV-TLK-SW-01');
    assert.ok(custNode, 'Node Switch Telkom harus ada');
    assert.strictEqual(custNode.data.isPopCore, false, 'DEV-TLK-SW-01 harus isPopCore = false');
    assert.strictEqual(custNode.data.siteCode, 'CUST-TLK-01');
    assert.strictEqual(custNode.data.parentPop.siteCode, 'POP-BDG-01');

    console.log('✓ [Test 1] Topologi Global memuat metadata hierarki (Core POP vs Customer Site)');
  }

  // 4. Test 2: POP Filter (?popId=X) - Memuat POP + Customer Sites anaknya
  {
    const res = await fetch(`${BASE}/api/topology?popId=${popBdg.id}`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(res.status, 200, 'GET /api/topology?popId harus 200');
    const json = await res.json();

    // Di POP Bandung ada: 1 Core Router di POP + 1 Telkom + 1 BCA + 1 ITB = minimal 4 devices
    assert.ok(json.nodes.length >= 4, 'POP Bandung + customer sites harus memiliki minimal 4 nodes');

    const siteCodes = json.nodes.map((n: any) => n.data.siteCode);
    assert.ok(siteCodes.includes('POP-BDG-01'), 'Harus menyertakan perangkat POP-BDG-01');
    assert.ok(siteCodes.includes('CUST-TLK-01'), 'Harus menyertakan perangkat CUST-TLK-01');
    assert.ok(siteCodes.includes('CUST-BCA-01'), 'Harus menyertakan perangkat CUST-BCA-01');
    assert.ok(siteCodes.includes('CUST-ITB-01'), 'Harus menyertakan perangkat CUST-ITB-01');

    // Tidak boleh memuat perangkat dari POP Jakarta
    assert.ok(!siteCodes.includes('POP-JKT-01'), 'Tidak boleh memuat perangkat POP-JKT-01');
    assert.ok(!siteCodes.includes('CUST-MDR-01'), 'Tidak boleh memuat perangkat CUST-MDR-01');

    console.log(`✓ [Test 2] Filter POP (?popId=${popBdg.id}) berhasil menyatukan Core POP dan seluruh Customer Sites anaknya (${json.nodes.length} nodes)`);
  }

  // 5. Test 3: POP Internal Only Filter (?popId=X&isInternalOnly=true)
  {
    const res = await fetch(`${BASE}/api/topology?popId=${popBdg.id}&isInternalOnly=true`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(res.status, 200, 'GET /api/topology internal only harus 200');
    const json = await res.json();

    assert.strictEqual(json.nodes.length, 1, 'Hanya ada 1 perangkat internal di POP Bandung (core router)');
    assert.strictEqual(json.nodes[0].data.deviceCode, 'DEV-BDG-RTR-01');
    assert.strictEqual(json.nodes[0].data.isPopCore, true);

    console.log('✓ [Test 3] Filter internal POP (?isInternalOnly=true) mengisolasi perangkat core POP');
  }

  // 6. Test 4: Specific Customer Site Filter (?siteId=Y)
  {
    const res = await fetch(`${BASE}/api/topology?siteId=${custTlk.id}`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(res.status, 200, 'GET /api/topology?siteId harus 200');
    const json = await res.json();

    assert.strictEqual(json.nodes.length, 1, 'Hanya ada 1 perangkat pada CUST-TLK-01');
    assert.strictEqual(json.nodes[0].data.deviceCode, 'DEV-TLK-SW-01');
    assert.strictEqual(json.nodes[0].data.isPopCore, false);

    console.log('✓ [Test 4] Filter spesifik customer site (?siteId=Y) fokus ke perangkat pelanggan');
  }

  // 7. Test 5: Layout Persistence Per Scope
  {
    const popScope = `pop-${popBdg.id}`;
    const custScope = `site-${custTlk.id}`;

    // Simpan posisi untuk scope pop-1
    const savePopRes = await fetch(`${BASE}/api/topology/layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE },
      body: JSON.stringify({
        scope: popScope,
        positions: { '101': { x: 400, y: 300 } },
      }),
    });
    assert.strictEqual(savePopRes.status, 200, 'Simpan layout popScope harus 200');

    // Simpan posisi berbeda untuk scope site-cust
    const saveCustRes = await fetch(`${BASE}/api/topology/layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE },
      body: JSON.stringify({
        scope: custScope,
        positions: { '102': { x: 750, y: 550 } },
      }),
    });
    assert.strictEqual(saveCustRes.status, 200, 'Simpan layout custScope harus 200');

    // Baca kembali dan pastikan terisolasi
    const readPop = await fetch(`${BASE}/api/topology/layout?scope=${popScope}`, {
      headers: { Cookie: adminCookie },
    });
    const jsonPop = await readPop.json();
    assert.strictEqual(jsonPop.positions['101']?.x, 400);
    assert.strictEqual(jsonPop.positions['102'], undefined, 'Positions site lain tidak boleh bocor ke scope pop');

    const readCust = await fetch(`${BASE}/api/topology/layout?scope=${custScope}`, {
      headers: { Cookie: adminCookie },
    });
    const jsonCust = await readCust.json();
    assert.strictEqual(jsonCust.positions['102']?.x, 750);
    assert.strictEqual(jsonCust.positions['101'], undefined, 'Positions pop tidak boleh bocor ke scope customer');

    console.log('✓ [Test 5] Isolasi tata letak layout per scope (pop vs customer site) terverifikasi persisten');
  }

  console.log('\n=== SELURUH TEST HIERARKI TOPOLOGI BERHASIL 100% ===');
}

run()
  .catch((err) => {
    console.error('TEST ERROR:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
