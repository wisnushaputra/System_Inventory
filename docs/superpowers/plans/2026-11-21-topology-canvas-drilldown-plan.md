# In-Canvas Graph Drill-Down Topology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan visualisasi topologi graf bertingkat di dalam kanvas React Flow (Pusat -> Node POP -> Node Site Pelanggan -> Node Perangkat) lengkap dengan interaksi klik drill-down, breadcrumb, dan panel detail.

**Architecture:** API `/api/topology` menyediakan endpoint graf per level (`level=pops`, `level=sites`, `level=devices`) yang menghasilkan nodes dan edges terstruktur. Pada `TopologyClient.tsx`, React Flow merender node kustom (`rootNode`, `popNode`, `siteNode`, `deviceNode`) yang merespons event klik untuk bertransisi antartingkat hierarki.

**Tech Stack:** Next.js 16.4.6, React 19, @xyflow/react v13, Prisma ORM, PostgreSQL, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-11-21-topology-canvas-drilldown-design.md`

## Global Constraints
- Tidak ada label status up/down/online/offline pada graf (DoD T7.1).
- Klik node Level 3 menampilkan detail perangkat; klik edge menampilkan dua port terhubung (DoD T7.1).
- Tata letak posisi node per scope tetap tersimpan persisten (DoD T7.2).
- Validasi Origin CSRF untuk mutasi layout (T9.1).
- Bebas dari karakter em dash pada teks antarmuka (Aturan Antislop R-02).

## Review Focus
1. Di awal kanvas React Flow muncul simpul Pusat dan simpul-simpul POP dengan garis koneksi.
2. Mengklik simpul POP berpindah ke kanvas Site Pelanggan di bawah POP tersebut.
3. Mengklik simpul Site Pelanggan berpindah ke kanvas perangkat dan koneksi port fisik site tersebut.
4. Breadcrumb dan tombol kembali bekerja dengan benar di setiap level.
5. Backward-compatibility untuk query topologi flat tetap terjaga (uji regresi `test-phase7.ts` tetap lolos).

---

### Task 1: Perluas API `/api/topology` dengan Mode Graf Bertingkat (`level`)
**Files:**
- Modify: `nims/src/app/api/topology/route.ts`

**Steps:**
- [ ] 1.1 Tambahkan penanganan `level === 'pops'` yang mengembalikan node Root Pusat dan node-node POP dengan edge dari Pusat ke masing-masing POP.
- [ ] 1.2 Tambahkan penanganan `level === 'sites'` dengan `popId` yang mengembalikan node POP induk di atas dan node-node Customer Site di bawahnya.
- [ ] 1.3 Pertahankan penanganan perangkat fisik (`level === 'devices'` atau default) untuk mengembalikan perangkat dan koneksi kabel.

---

### Task 2: Implementasi Custom Nodes & In-Canvas Drill-Down di `TopologyClient.tsx`
**Files:**
- Modify: `nims/src/app/(protected)/topology/TopologyClient.tsx`

**Steps:**
- [ ] 2.1 Buat komponen custom node: `RootCustomNode`, `PopCustomNode`, `SiteCustomNode`, dan pertahankan `DeviceCustomNode`.
- [ ] 2.2 Daftarkan tipe node tersebut pada `nodeTypes` React Flow.
- [ ] 2.3 Tangani event klik node pada kanvas: jika klik `popNode` -> panggil `setLevel('sites')` & `setPopId(popId)`; jika klik `siteNode` -> panggil `setLevel('devices')` & `setSiteId(siteId)`.
- [ ] 2.4 Tambahkan Breadcrumb navigasi dan tombol `← Kembali` di atas kanvas.
- [ ] 2.5 Tambahkan daftar tabel perangkat site di bawah kanvas saat berada di Level 3 (Daftar Perangkat Site).
- [ ] 2.6 Tambahkan Tab Switcher di header: "🗂️ Navigasi Graf Bertingkat" vs "🌐 Topologi Global (Semua Perangkat)".

---

### Task 3: Uji Coba TDD, Regresi, dan Verifikasi Build
**Files:**
- Create: `nims/scripts/test-topology-drilldown.ts`

**Steps:**
- [ ] 3.1 Buat skrip uji `nims/scripts/test-topology-drilldown.ts` untuk menguji level=pops, level=sites, level=devices, dan interaksi breadcrumb.
- [ ] 3.2 Jalankan `test-topology-drilldown.ts` dan pastikan 100% PASS.
- [ ] 3.3 Jalankan seluruh regresi topologi (`test-phase7.ts` dan `test-topology-hierarchy.ts`).
- [ ] 3.4 Jalankan `npm run build` dan restart server daemon.
- [ ] 3.5 Commit perubahan ke Git.
