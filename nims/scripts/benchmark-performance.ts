/**
 * Performance Benchmark Test — 2.000 Perangkat / 20.000 Port / 50.000 Alamat IP (T9.3 / §11.2)
 *
 * Targets from PRD §11.2:
 * 1. Halaman daftar perangkat memuat dalam waktu ≤ 3 detik (3.000 ms).
 * 2. Pencarian sederhana memberikan hasil dalam waktu ≤ 2 detik (2.000 ms).
 * 3. Pagination mencegah pengambilan seluruh data sekaligus (memory safety).
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

async function measure<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  console.log(`⏱️  [${name}] selesai dalam ${durationMs} ms`);
  return { result, durationMs };
}

async function main() {
  console.log('=== MEMULAI PENGUJIAN PERFORMA & TOLOK UKUR SKALABILITAS (T9.3) ===\n');

  // Bersihkan sisa data benchmark lama jika ada
  console.log('1. Membersihkan data uji performa lama...');
  await prisma.ipAddress.deleteMany({ where: { address: { startsWith: '10.200.' } } });
  await prisma.interface.deleteMany({ where: { name: { startsWith: 'perf-p-' } } });
  await prisma.device.deleteMany({ where: { deviceCode: { startsWith: 'PERF-DEV-' } } });
  await prisma.subnet.deleteMany({ where: { cidr: { startsWith: '10.200.' } } });

  // Ambil referensi master data
  const [site, cat, vendor] = await Promise.all([
    prisma.site.findFirstOrThrow(),
    prisma.deviceCategory.findFirstOrThrow(),
    prisma.vendor.findFirstOrThrow(),
  ]);

  // 1. Buat Subnet uji untuk 50.000 IP
  console.log('\n2. Membuat subnet uji untuk 50.000 IP...');
  const testSubnet = await prisma.subnet.create({
    data: {
      name: 'Subnet Benchmark 10.200.0.0/16',
      cidr: '10.200.0.0/16',
      siteId: site.id,
      purpose: 'management',
      status: 'active',
    },
  });

  // 2. Generate 2.000 Perangkat
  console.log('3. Melakukan seeding 2.000 perangkat (batch insert)...');
  const deviceData: Array<{
    deviceCode: string;
    hostname: string;
    categoryId: number;
    vendorId: number;
    siteId: number;
    inventoryStatus: string;
    networkRole: string;
    description: string;
  }> = [];
  for (let i = 1; i <= 2000; i++) {
    const pad = i.toString().padStart(4, '0');
    deviceData.push({
      deviceCode: `PERF-DEV-${pad}`,
      hostname: `rtr-perf-${pad}.isp.net`,
      categoryId: cat.id,
      vendorId: vendor.id,
      siteId: site.id,
      inventoryStatus: 'ACTIVE',
      networkRole: 'access',
      description: `Perangkat uji performa skala besar #${i}`,
    });
  }

  const { durationMs: devInsertTime } = await measure('Insert 2.000 Devices', async () => {
    await prisma.device.createMany({ data: deviceData });
  });

  // Ambil sample ID perangkat yang baru dibuat
  const seededDevices = await prisma.device.findMany({
    where: { deviceCode: { startsWith: 'PERF-DEV-' } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  assert.strictEqual(seededDevices.length, 2000, 'Gagal membuat 2.000 perangkat');

  // 3. Generate 20.000 Port (10 port per perangkat)
  console.log('4. Melakukan seeding 20.000 interfaces/port (batch insert)...');
  const interfaceData: Array<{
    deviceId: number;
    name: string;
    interfaceType: string;
    adminStatus: string;
  }> = [];
  for (const dev of seededDevices) {
    for (let p = 1; p <= 10; p++) {
      interfaceData.push({
        deviceId: dev.id,
        name: `perf-p-${p}`,
        interfaceType: 'ethernet',
        adminStatus: 'enabled',
      });
    }
  }

  // Insert interfaces dalam chunk 5.000
  const { durationMs: ifaceInsertTime } = await measure('Insert 20.000 Interfaces', async () => {
    const chunkSize = 5000;
    for (let i = 0; i < interfaceData.length; i += chunkSize) {
      await prisma.interface.createMany({ data: interfaceData.slice(i, i + chunkSize) });
    }
  });

  const totalIfaces = await prisma.interface.count({
    where: { name: { startsWith: 'perf-p-' } },
  });
  assert.strictEqual(totalIfaces, 20000, 'Gagal membuat 20.000 interfaces');

  // 4. Generate 50.000 Alamat IP (10.200.x.x)
  console.log('5. Melakukan seeding 50.000 IP addresses (batch insert)...');
  const ipData: Array<{
    subnetId: number;
    address: string;
    allocationStatus: string;
    purpose: string;
  }> = [];
  let ipCount = 0;
  for (let b = 1; b <= 200 && ipCount < 50000; b++) {
    for (let c = 1; c <= 254 && ipCount < 50000; c++) {
      ipData.push({
        subnetId: testSubnet.id,
        address: `10.200.${b}.${c}`,
        allocationStatus: 'AVAILABLE',
        purpose: 'other',
      });
      ipCount++;
    }
  }

  const { durationMs: ipInsertTime } = await measure('Insert 50.000 IP Addresses', async () => {
    const chunkSize = 10000;
    for (let i = 0; i < ipData.length; i += chunkSize) {
      await prisma.ipAddress.createMany({ data: ipData.slice(i, i + chunkSize) });
    }
  });

  const totalIps = await prisma.ipAddress.count({
    where: { subnetId: testSubnet.id },
  });
  assert.strictEqual(totalIps, 50000, 'Gagal membuat 50.000 IP addresses');

  console.log('\n============================================================');
  console.log(`📊 STATUS DATA SKALA BESAR TERCAPAI:`);
  console.log(`   - Total Perangkat: ${seededDevices.length.toLocaleString()} unit`);
  console.log(`   - Total Port:      ${totalIfaces.toLocaleString()} port`);
  console.log(`   - Total Alamat IP: ${totalIps.toLocaleString()} IP`);
  console.log('============================================================\n');

  // Login untuk pengujian API
  const adminCookie = await login('admin', 'Admin123!');

  // =========================================================================
  // PENGUKURAN 1: Halaman Daftar Perangkat (Target PRD §11.2: ≤ 3.000 ms)
  // =========================================================================
  console.log('--- Pengukuran 1: Pemuatan Halaman Daftar Perangkat (Limit 20, Pagination) ---');
  const { durationMs: listDuration, result: listRes } = await measure('GET /api/devices (Page 1)', async () => {
    return await fetch(`${BASE}/api/devices?page=1&limit=20`, {
      headers: { Cookie: adminCookie },
    });
  });
  assert.strictEqual(listRes.status, 200);
  const listJson = await listRes.json();
  assert.strictEqual(listJson.data.length, 20, 'Pagination harus membatasi 20 item per halaman');
  assert.ok(listJson.pagination.total >= 2000, 'Total inventaris harus mencakup data benchmark');
  assert.ok(
    listDuration <= 3000,
    `Target §11.2 terlanggar: Waktu muat daftar perangkat (${listDuration} ms) > 3.000 ms`
  );
  console.log(`✓ Lolos Kriteria §11.2: Daftar perangkat dimuat dalam ${listDuration} ms (Target: ≤ 3.000 ms)`);

  // =========================================================================
  // PENGUKURAN 2: Pencarian Perangkat Sederhana (Target PRD §11.2: ≤ 2.000 ms)
  // =========================================================================
  console.log('\n--- Pengukuran 2: Pencarian Perangkat Sederhana (Target PRD §11.2: ≤ 2.000 ms) ---');
  const { durationMs: searchDuration, result: searchRes } = await measure('GET /api/devices?q=PERF-DEV-1500', async () => {
    return await fetch(`${BASE}/api/devices?q=PERF-DEV-1500&limit=20`, {
      headers: { Cookie: adminCookie },
    });
  });
  assert.strictEqual(searchRes.status, 200);
  const searchJson = await searchRes.json();
  assert.strictEqual(searchJson.data.length, 1);
  assert.strictEqual(searchJson.data[0].deviceCode, 'PERF-DEV-1500');
  assert.ok(
    searchDuration <= 2000,
    `Target §11.2 terlanggar: Waktu pencarian (${searchDuration} ms) > 2.000 ms`
  );
  console.log(`✓ Lolos Kriteria §11.2: Pencarian perangkat selesai dalam ${searchDuration} ms (Target: ≤ 2.000 ms)`);

  // =========================================================================
  // PENGUKURAN 3: Filter Kategori & Status (Target PRD §11.2: ≤ 2.000 ms)
  // =========================================================================
  console.log('\n--- Pengukuran 3: Filter Kategori & Status Inventaris ---');
  const { durationMs: filterDuration, result: filterRes } = await measure('GET /api/devices?inventoryStatus=ACTIVE', async () => {
    return await fetch(`${BASE}/api/devices?inventoryStatus=ACTIVE&page=1&limit=20`, {
      headers: { Cookie: adminCookie },
    });
  });
  assert.strictEqual(filterRes.status, 200);
  assert.ok(
    filterDuration <= 2000,
    `Target filter terlanggar: Waktu filter (${filterDuration} ms) > 2.000 ms`
  );
  console.log(`✓ Lolos Kriteria §11.2: Filter inventaris selesai dalam ${filterDuration} ms (Target: ≤ 2.000 ms)`);

  // =========================================================================
  // PENGUKURAN 4: Pagination & Memory Safety
  // =========================================================================
  console.log('\n--- Pengukuran 4: Verifikasi Pagination & Memory Safety ---');
  const page10Res = await fetch(`${BASE}/api/devices?page=10&limit=50`, {
    headers: { Cookie: adminCookie },
  });
  const page10Json = await page10Res.json();
  assert.strictEqual(page10Json.data.length, 50, 'Page 10 harus tepat mengembalikan 50 entri');
  assert.strictEqual(page10Json.pagination.page, 10);
  console.log(`✓ Lolos Kriteria §11.2: Pagination mencegah pemuatan seluruh 2.000 data sekaligus.`);

  // =========================================================================
  // CLEANUP DATA BENCHMARK
  // =========================================================================
  console.log('\n--- Cleanup Data Uji Skala Besar ---');
  await prisma.ipAddress.deleteMany({ where: { subnetId: testSubnet.id } });
  await prisma.interface.deleteMany({ where: { name: { startsWith: 'perf-p-' } } });
  await prisma.device.deleteMany({ where: { deviceCode: { startsWith: 'PERF-DEV-' } } });
  await prisma.subnet.delete({ where: { id: testSubnet.id } });
  console.log('✓ Cleanup selesai: Seluruh 2.000 perangkat, 20.000 port, dan 50.000 IP telah dibersihkan.');

  console.log('\n============================================================');
  console.log('🎉 PENGUJIAN PERFORMA FASE 9 (T9.3 / §11.2) LULUS 100%!');
  console.log(`   - Muat Daftar (2.000 devices): ${listDuration} ms (Target: ≤ 3.000 ms) -> LULUS`);
  console.log(`   - Cari Perangkat:               ${searchDuration} ms (Target: ≤ 2.000 ms) -> LULUS`);
  console.log(`   - Filter Inventaris:           ${filterDuration} ms (Target: ≤ 2.000 ms) -> LULUS`);
  console.log('============================================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Benchmark Performa Gagal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
