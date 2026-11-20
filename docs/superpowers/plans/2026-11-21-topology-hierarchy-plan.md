# Topologi Relasi Jaringan Berbasis Hierarki POP & Customer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyesuaikan visualisasi Topologi Relasi Jaringan (`/topology`) agar selaras dengan hierarki Site Induk (POP) -> Site Anak (Customer) -> Perangkat, dengan filter berjenjang dan penanda lokasi hierarkis pada node graf.

**Architecture:** API `/api/topology` diperluas dengan parameter `popId` dan `siteId` untuk menarik perangkat internal POP dan seluruh customer site anaknya. Pada antarmuka pengguna (`TopologyClient.tsx`), filter diganti menjadi selektor berjenjang dengan breadcrumb navigasi dan badge hierarki pada node React Flow.

**Tech Stack:** Next.js 16.4.6 App Router, React 19, @xyflow/react v13, Prisma ORM, PostgreSQL, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-11-21-topology-hierarchy-design.md`

## Global Constraints
- Tidak ada label status up/down/online/offline pada graf (DoD T7.1).
- Klik node harus menampilkan detail perangkat & lokasi hierarki; klik edge menampilkan dua port terhubung (DoD T7.1).
- Menyimpan dan memuat posisi node per user harus tetap berfungsi persisten (DoD T7.2).
- Seluruh mutasi API memerlukan validasi Origin CSRF (T9.1).
- Bebas dari karakter em dash pada teks antarmuka (Aturan Antislop R-02).

## Review Focus
1. Filter POP mengambil seluruh node perangkat internal POP sekaligus perangkat di customer site anaknya.
2. Filter customer site tertentu hanya memuat node dan edge yang relevan dengan customer site tersebut.
3. Node perangkat menampilkan label hierarki yang jelas (`[📍 POP Bandung - Core]` atau `[👥 PT Telkom Dago]`).
4. Penyimpanan layout dengan scope `pop-${popId}` dan `site-${siteId}` tidak saling menimpa.
5. Akses unauthenticated ke API topologi ditolak dengan kode status 401.

---

### Task 1: Perluas API Topologi untuk Mendukung Hierarki (`/api/topology`)
**Files:**
- Modify: `nims/src/app/api/topology/route.ts`

**Steps:**
- [ ] 1.1 Modifikasi `nims/src/app/api/topology/route.ts` untuk membaca parameter `popId`, `siteId`, dan `isInternalOnly`.
- [ ] 1.2 Sesuaikan `whereClause` pada `prisma.device.findMany` agar jika `popId` diberikan tanpa `siteId`, mengambil perangkat dengan `siteId = popId` ATAU `site.parentSiteId = popId`.
- [ ] 1.3 Sertakan `parentSite` pada query `site` di Prisma (`include: { site: { include: { parentSite: true } } }`).
- [ ] 1.4 Tambahkan properti hierarki pada node data: `parentPop`, `isPopCore`, `siteName`, `siteType`.

---

### Task 2: Perbarui Antarmuka Topologi dengan Filter Berjenjang & Breadcrumb
**Files:**
- Modify: `nims/src/app/(protected)/topology/page.tsx`
- Modify: `nims/src/app/(protected)/topology/TopologyClient.tsx`

**Steps:**
- [ ] 2.1 Update `page.tsx` untuk mengambil master site lengkap dengan relasi `parentSite` (`select: { id: true, siteCode: true, name: true, siteType: true, parentSiteId: true }`).
- [ ] 2.2 Pada `TopologyClient.tsx`, pisahkan daftar site menjadi `pops` (`siteType === 'pop' || !parentSiteId`) dan `customerSites` (`siteType === 'customer_site'`).
- [ ] 2.3 Ganti filter flat site dengan dua dropdown berjenjang: Dropdown 1 (Pilih POP Induk) dan Dropdown 2 (Pilih Customer Site / Lingkup).
- [ ] 2.4 Tambahkan Breadcrumb Topologi interaktif di atas bilah filter (`🏢 Topologi / 📍 [Nama POP] / 👥 [Nama Customer]`).
- [ ] 2.5 Perbarui `DeviceCustomNode` untuk merender badge hierarki lokasi (Core POP vs Customer).
- [ ] 2.6 Perbarui panel detail saat node dan edge diklik agar menampilkan informasi hierarki POP dan customer.

---

### Task 3: Uji Coba TDD, Regresi, dan Verifikasi Build
**Files:**
- Create: `nims/scripts/test-topology-hierarchy.ts`

**Steps:**
- [ ] 3.1 Buat skrip uji `nims/scripts/test-topology-hierarchy.ts` untuk memverifikasi fungsionalitas hierarki topologi via API.
- [ ] 3.2 Jalankan `test-topology-hierarchy.ts` dan pastikan lolos 100%.
- [ ] 3.3 Jalankan seluruh regresi topologi (`test-phase7.ts`) dan pastikan tetap hijau.
- [ ] 3.4 Jalankan `npm run build` dan nyalakan ulang server produksi daemon.
- [ ] 3.5 Commit perubahan ke Git dengan format conventional commit.
