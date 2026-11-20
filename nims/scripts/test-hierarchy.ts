/**
 * Hierarchical Device Inventory Test — Drill-Down (POP -> Customer Site -> Devices)
 *
 * Verifies:
 * 1. Level 1: POP list with customer site & total device counts
 * 2. Level 2: Customer sites under a specific POP with device counts
 * 3. Level 3: Site detail & breadcrumb context (POP parent info)
 * 4. Level 3: Devices query filtered by customer siteId
 * 5. Master Site: Creating child customer site under POP with parentSiteId
 * 6. RBAC: Unauthorized rejected (401), Authorized permitted (200)
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
  console.log('=== MEMULAI TEST HIERARKI PERANGKAT (POP -> CUSTOMER -> DEVICES) ===\n');

  // 1. Auth Setup
  const adminCookie = await login('admin', 'Admin123!');
  console.log('✓ [Auth] Admin login berhasil');

  const operatorCookie = await login('operator', 'Operator123!');
  console.log('✓ [Auth] Operator login berhasil');

  // 2. RBAC check: Unauthenticated rejected
  {
    const res = await fetch(`${BASE}/api/devices/hierarchy`);
    assert.strictEqual(res.status, 401, 'Request tanpa cookie harus ditolak 401');
    console.log('✓ [RBAC] Unauthenticated access ditolak 401');
  }

  // 3. Level 1: List POPs
  let popBdgId = 0;
  let popJktId = 0;
  {
    const res = await fetch(`${BASE}/api/devices/hierarchy`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(res.status, 200, 'GET /api/devices/hierarchy harus 200');
    const json = await res.json();
    assert.ok(Array.isArray(json.data.pops), 'pops harus berupa array');
    assert.ok(json.data.pops.length >= 2, 'Harus ada minimal 2 POP');

    const popBdg = json.data.pops.find((p: any) => p.siteCode === 'POP-BDG-01');
    assert.ok(popBdg, 'POP-BDG-01 harus ada');
    assert.strictEqual(popBdg.customerSiteCount, 3, 'POP Bandung harus punya 3 customer sites');
    assert.ok(popBdg.totalDeviceCount >= 4, 'Total device di POP Bandung + customer sites minimal 4');
    popBdgId = popBdg.id;

    const popJkt = json.data.pops.find((p: any) => p.siteCode === 'POP-JKT-01');
    assert.ok(popJkt, 'POP-JKT-01 harus ada');
    assert.ok(popJkt.customerSiteCount >= 1, 'POP Jakarta harus punya minimal 1 customer site');
    popJktId = popJkt.id;

    console.log(`✓ [Level 1] Daftar POP valid: Bandung (3 customer sites, ${popBdg.totalDeviceCount} devices), Jakarta (1 customer site, ${popJkt.totalDeviceCount} devices)`);
  }

  // 4. Level 2: List Customer Sites under POP Bandung
  let custTlkId = 0;
  {
    const res = await fetch(`${BASE}/api/devices/hierarchy?popId=${popBdgId}`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(res.status, 200, 'GET hierarchy?popId harus 200 untuk Operator NOC');
    const json = await res.json();

    assert.strictEqual(json.data.pop.siteCode, 'POP-BDG-01');
    assert.strictEqual(json.data.pop.directDeviceCount, 1, 'Perangkat langsung di POP Bandung ada 1 (core router)');
    assert.strictEqual(json.data.customerSites.length, 3, 'Harus ada 3 customer sites di Bandung');

    const tlk = json.data.customerSites.find((c: any) => c.siteCode === 'CUST-TLK-01');
    assert.ok(tlk, 'Customer PT Telkom harus ada');
    assert.strictEqual(tlk.deviceCount, 1, 'Customer PT Telkom punya 1 perangkat');
    custTlkId = tlk.id;

    const bca = json.data.customerSites.find((c: any) => c.siteCode === 'CUST-BCA-01');
    assert.ok(bca, 'Customer Bank BCA harus ada');
    assert.strictEqual(bca.deviceCount, 1, 'Customer Bank BCA punya 1 perangkat');

    const itb = json.data.customerSites.find((c: any) => c.siteCode === 'CUST-ITB-01');
    assert.ok(itb, 'Customer ITB harus ada');
    assert.strictEqual(itb.deviceCount, 1, 'Customer ITB punya 1 perangkat');

    console.log('✓ [Level 2] Daftar Customer Sites di bawah POP-BDG-01 berhasil diverifikasi');
  }

  // 5. Level 3 Context: Site details & Breadcrumbs
  {
    const res = await fetch(`${BASE}/api/devices/hierarchy?siteId=${custTlkId}`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(res.status, 200, 'GET hierarchy?siteId harus 200');
    const json = await res.json();

    assert.strictEqual(json.data.site.siteCode, 'CUST-TLK-01');
    assert.strictEqual(json.data.isPop, false, 'Customer site bukan POP');
    assert.strictEqual(json.data.parentPop.siteCode, 'POP-BDG-01', 'Parent POP harus POP-BDG-01');

    console.log('✓ [Level 3 Context] Breadcrumb site hierarchy valid (POP-BDG-01 -> CUST-TLK-01)');
  }

  // 6. Level 3 Devices: Fetch Devices at Customer Site
  {
    const res = await fetch(`${BASE}/api/devices?siteId=${custTlkId}`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(res.status, 200, 'GET /api/devices?siteId harus 200');
    const json = await res.json();

    assert.strictEqual(json.pagination.total, 1, 'Harus ada 1 perangkat pada CUST-TLK-01');
    assert.strictEqual(json.data[0].deviceCode, 'DEV-TLK-SW-01');
    assert.strictEqual(json.data[0].hostname, 'cust-tlk-sw01');
    assert.strictEqual(json.data[0].site.siteCode, 'CUST-TLK-01');

    console.log('✓ [Level 3 Devices] Perangkat customer site berhasil diambil (DEV-TLK-SW-01)');
  }

  // 7. Master Site Creation with parentSiteId
  {
    const newSiteCode = `CUST-TEST-${Date.now().toString().slice(-4)}`;
    const createRes = await fetch(`${BASE}/api/master/sites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: BASE },
      body: JSON.stringify({
        siteCode: newSiteCode,
        name: 'Test Customer Branch',
        siteType: 'customer_site',
        parentSiteId: popJktId,
        city: 'Jakarta Selatan',
        status: 'active',
      }),
    });
    assert.strictEqual(createRes.status, 201, 'Create site dengan parentSiteId harus 201');
    const createJson = await createRes.json();
    assert.strictEqual(createJson.data.parentSiteId, popJktId, 'parentSiteId harus cocok');

    // Query back under POP Jakarta
    const checkRes = await fetch(`${BASE}/api/devices/hierarchy?popId=${popJktId}`, {
      headers: { Cookie: adminCookie },
    });
    const checkJson = await checkRes.json();
    const created = checkJson.data.customerSites.find((c: any) => c.siteCode === newSiteCode);
    assert.ok(created, 'Customer site baru harus muncul di bawah POP Jakarta');

    console.log(`✓ [Master Site] Pembuatan customer site baru (${newSiteCode}) di bawah POP berhasil`);

    // Cleanup test site
    await prisma.site.deleteMany({
      where: { siteCode: { startsWith: 'CUST-TEST-' } },
    });
    console.log('✓ [Cleanup] Data uji customer site dibersihkan');
  }

  console.log('\n=== SELURUH TEST HIERARKI PERANGKAT BERHASIL 100% ===');
}

run()
  .catch((err) => {
    console.error('TEST ERROR:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
