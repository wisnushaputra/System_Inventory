# Desain Teknis: Topologi Relasi Jaringan Berbasis Hierarki POP & Customer Site

## 1. Latar Belakang & Tujuan
Menyelaraskan visualisasi graf **Topologi Relasi Jaringan** (`/topology`) dengan hierarki organisasi infrastruktur jaringan yang baru:
$$\text{POP Induk (Point of Presence)} \longrightarrow \text{Site Anak (Customer Site)} \longrightarrow \text{Perangkat Jaringan}$$

Sebelumnya, topologi hanya menyajikan dropdown daftar site datar (*flat list*) sehingga operator tidak dapat melihat relasi kabel/link fiber optik antara POP dan pelanggan dalam satu diagram utuh. Dengan desain ini, operator dapat:
1. Memilih POP Induk untuk melihat topologi keterhubungan backbone POP ke seluruh Customer Site di bawahnya.
2. Melakukan *drill-down* fokus ke satu Customer Site tertentu atau perangkat internal POP saja.
3. Mengidentifikasi lokasi fisik dan peran perangkat pada graf secara instan melalui label/badge hierarki.

---

## 2. Pendekatan yang Dipilih
**Opsi 1: Filter Berjenjang Dinamis + Graf Keterhubungan Backbone & Pelanggan**
- Menghubungkan node perangkat internal POP (Core/Aggregation) dengan node perangkat di Customer Site (CPE/Switch Pelanggan) melalui relasi koneksi aktif (`NetworkConnection`).
- Menyediakan selektor berjenjang di bilah kontrol atas dan breadcrumb navigasi topologi.

---

## 3. Spesifikasi Perubahan Komponen & API

### 3.1 Backend API: `/api/topology` & `/api/topology/layout`
- **Query Parameters**:
  - `popId` (opsional): ID POP induk. Jika diberikan tanpa `siteId`, sistem mengambil perangkat di POP tersebut (`siteId = popId`) **beserta** seluruh perangkat pada customer site anaknya (`site.parentSiteId = popId`).
  - `siteId` (opsional): ID site spesifik (bisa customer site atau POP). Jika diberikan, sistem hanya mengambil perangkat pada site tersebut.
  - `isInternalOnly` (opsional): Jika `'true'`, hanya mengambil perangkat yang langsung berada di POP (`siteId = popId`).
  - `categoryId`, `relationType`, `medium` (tetap dipertahankan dari filter sebelumnya).
- **Data Node**:
  Menyertakan metadata hierarki pada `data`:
  - `siteId`, `siteCode`, `siteName`, `siteType`
  - `parentPop`: `{ id, siteCode, name }` (jika site anak)
  - `isPopCore`: boolean (apakah perangkat berada langsung di POP induk)
- **Layout Scope**:
  Mendukung scope penyimpanan layout per user:
  - `pop-${popId}` saat melihat seluruh POP
  - `site-${siteId}` saat melihat spesifik site
  - `default` saat melihat global

### 3.2 Frontend: `TopologyClient.tsx` & `page.tsx`
- **Bilah Kontrol Berjenjang**:
  - **Dropdown 1: Pilih POP Induk** (`Semua POP`, `POP Bandung Dago`, `POP Jakarta Cyber`, dll).
  - **Dropdown 2: Lingkup / Site Pelanggan** (muncul saat POP dipilih):
    - *"Semua Site di POP ini (Backbone & Seluruh Pelanggan)"*
    - *"Infrastruktur Internal POP Saja"*
    - Daftar spesifik customer site di bawah POP tersebut.
- **Breadcrumb Topologi**:
  `🏢 Topologi / 📍 POP Bandung Dago / 👥 PT Telkom Dago Hub`
- **Custom Node (`DeviceCustomNode`)**:
  - Tampilan tag lokasi:
    - Jika Core POP: badge ungu `[📍 POP Bandung - Core]`
    - Jika Customer: badge biru `[👥 PT Telkom Dago]`
- **Detail Panel**:
  - Panel samping saat node diklik menampilkan informasi induk POP dan site pelanggan.
  - Panel samping saat edge diklik menampilkan detail port endpoint A dan endpoint B beserta media dan tipe relasi.

---

## 4. Kriteria Keberhasilan (DoD)
1. Filter POP mengambil seluruh perangkat di POP dan seluruh customer site anaknya.
2. Pemilihan spesifik customer site hanya menampilkan perangkat di customer site tersebut.
3. Node perangkat menampilkan badge hierarki lokasi yang jelas dan kontras.
4. Klik node menampilkan detail perangkat & lokasi induk (POP & Customer).
5. Klik edge menampilkan dua port terhubung (DoD T7.1).
6. Tidak ada label status palsu up/down/online/offline (DoD T7.1).
7. Simpan & muat layout node per user tetap berfungsi persisten (DoD T7.2).
8. Seluruh pengujian otomatis dan uji regresi lolos 100%.
