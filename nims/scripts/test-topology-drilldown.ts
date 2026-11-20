/**
 * In-Canvas Graph Drill-Down Topology Test
 *
 * Verifies:
 * 1. Level 1: GET /api/topology?level=pops returns root-noc node and POP nodes with backbone edges.
 * 2. Level 2: GET /api/topology?level=sites&popId=X returns parent POP node and customer site nodes with access edges.
 * 3. Level 3: GET /api/topology?level=devices&siteId=Y returns real device nodes with port connections.
 * 4. Backward Compatibility: GET /api/topology (no level) continues returning global flat device graph.
 * 5. RBAC: Unauthorized access is rejected (401).
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
  console.log('=== MEMULAI TEST DRILL-DOWN TOPOLOGI GRAF (PUSAT -> POP -> SITE -> PERANGKAT) ===\n');

  // 1. Auth Setup
  const adminCookie = await login('admin', 'Admin123!');
  console.log('✓ [Auth] Admin login berhasil');

  const operatorCookie = await login('operator', 'Operator123!');
  console.log('✓ [Auth] Operator login berhasil');

  // 2. RBAC check: Unauthenticated rejected
  {
    const res = await fetch(`${BASE}/api/topology?level=pops`);
    assert.strictEqual(res.status, 401, 'Request tanpa cookie harus ditolak 401');
    console.log('✓ [RBAC] Unauthenticated access ditolak 401');
  }

  // Cari ID POP Bandung dan Customer Site Telkom dari DB
  const popBdg = await prisma.site.findUniqueOrThrow({ where: { siteCode: 'POP-BDG-01' } });
  const custTlk = await prisma.site.findUniqueOrThrow({ where: { siteCode: 'CUST-TLK-01' } });

  // 3. Test 1: Level 1 (Topologi POPs di Kanvas)
  {
    const res = await fetch(`${BASE}/api/topology?level=pops`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(res.status, 200, 'GET ?level=pops harus 200');
    const json = await res.json();

    assert.strictEqual(json.metadata.level, 'pops');
    assert.ok(Array.isArray(json.nodes), 'nodes harus berupa array');

    // Cek Root Node (NOC Pusat)
    const root = json.nodes.find((n: any) => n.id === 'root-noc');
    assert.ok(root, 'Node root-noc (Pusat) harus ada');
    assert.strictEqual(root.type, 'rootNode');
    assert.ok(root.data.popCount >= 2, 'Jumlah POP di root minimal 2');

    // Cek Simpul POP Bandung & Jakarta
    const popBdgNode = json.nodes.find((n: any) => n.id === `pop-${popBdg.id}`);
    assert.ok(popBdgNode, 'Simpul POP Bandung harus ada');
    assert.strictEqual(popBdgNode.type, 'popNode');
    assert.strictEqual(popBdgNode.data.siteCode, 'POP-BDG-01');
    assert.strictEqual(popBdgNode.data.customerSiteCount, 3);

    // Cek Edges dari Root ke POP
    const edgeToBdg = json.edges.find((e: any) => e.source === 'root-noc' && e.target === `pop-${popBdg.id}`);
    assert.ok(edgeToBdg, 'Harus ada edge dari root-noc ke POP Bandung');

    console.log(`✓ [Level 1] Kanvas POP berhasil: Root NOC terhubung ke ${json.nodes.length - 1} simpul POP`);
  }

  // 4. Test 2: Level 2 (Topologi Site Pelanggan di bawah POP)
  {
    const res = await fetch(`${BASE}/api/topology?level=sites&popId=${popBdg.id}`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(res.status, 200, 'GET ?level=sites harus 200');
    const json = await res.json();

    assert.strictEqual(json.metadata.level, 'sites');

    // Cek Node POP Induk di atas
    const parentNode = json.nodes.find((n: any) => n.id === `pop-parent-${popBdg.id}`);
    assert.ok(parentNode, 'Node pop-parent harus ada di Level 2');
    assert.strictEqual(parentNode.type, 'popParentNode');

    // Cek Simpul Customer Sites
    const tlkNode = json.nodes.find((n: any) => n.id === `site-${custTlk.id}`);
    assert.ok(tlkNode, 'Simpul PT Telkom harus ada di Level 2');
    assert.strictEqual(tlkNode.type, 'siteNode');
    assert.strictEqual(tlkNode.data.siteCode, 'CUST-TLK-01');
    assert.strictEqual(tlkNode.data.deviceCount, 1);

    // Cek Edge dari POP ke Site Pelanggan
    const edgeToTlk = json.edges.find((e: any) => e.source === `pop-parent-${popBdg.id}` && e.target === `site-${custTlk.id}`);
    assert.ok(edgeToTlk, 'Harus ada edge penghubung dari POP Bandung ke PT Telkom');

    console.log(`✓ [Level 2] Kanvas Site Pelanggan berhasil: POP Bandung terhubung ke ${json.nodes.length - 1} site anak`);
  }

  // 5. Test 3: Level 3 (Topologi Perangkat di dalam Site)
  {
    const res = await fetch(`${BASE}/api/topology?level=devices&siteId=${custTlk.id}`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(res.status, 200, 'GET ?level=devices harus 200');
    const json = await res.json();

    assert.strictEqual(json.metadata.level, 'devices');
    assert.strictEqual(json.nodes.length, 1, 'Hanya ada 1 perangkat di CUST-TLK-01');
    assert.strictEqual(json.nodes[0].data.deviceCode, 'DEV-TLK-SW-01');
    assert.strictEqual(json.nodes[0].data.hostname, 'cust-tlk-sw01');
    assert.strictEqual(json.nodes[0].type, 'deviceNode');

    console.log('✓ [Level 3] Kanvas Perangkat berhasil memuat perangkat nyata di Customer Site');
  }

  // 6. Test 4: Backward Compatibility (Topologi Global Tanpa Parameter Level)
  {
    const res = await fetch(`${BASE}/api/topology`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(res.status, 200, 'GET /api/topology flat global harus 200');
    const json = await res.json();

    assert.ok(json.nodes.length >= 5, 'Topologi global harus memuat seluruh perangkat');
    assert.strictEqual(json.nodes[0].type, 'deviceNode');

    console.log('✓ [Compatibility] Topologi flat global tetap berfungsi 100% untuk mode alternatif');
  }

  console.log('\n=== SELURUH TEST DRILL-DOWN TOPOLOGI GRAF BERHASIL 100% ===');
}

run()
  .catch((err) => {
    console.error('TEST ERROR:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
