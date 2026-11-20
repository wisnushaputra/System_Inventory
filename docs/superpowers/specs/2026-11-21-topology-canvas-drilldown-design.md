# Desain Teknis: Topologi Relasi Jaringan In-Canvas Graph Drill-Down

## 1. Latar Belakang & Kebutuhan Pengguna
Pengguna menginginkan representasi visual Topologi Relasi Jaringan (`/topology`) berbentuk graf bertingkat (*hierarchical in-canvas drill-down*):
1. **Level 1 (Topologi POP)**: Di awal kanvas React Flow memunculkan simpul Pusat/Backbone yang terhubung ke simpul-simpul **POP** (POP 1, POP 2, POP 3).
2. **Level 2 (Topologi Site Pelanggan)**: Simpul POP diklik $\to$ kanvas masuk ke dalam POP tersebut dan memunculkan simpul-simpul **Site Pelanggan** (Customer Sites).
3. **Level 3 (Topologi Perangkat)**: Simpul Customer Site diklik $\to$ kanvas masuk ke dalam site tersebut dan memunculkan **graf perangkat fisik & koneksi kabel antarmuka** beserta daftar perangkatnya.

---

## 2. Arsitektur Komponen & Alur Interaksi

### 2.1 Backend API (`/api/topology`)
Mendukung parameter query:
- `level`:
  - `pops`: Mengembalikan graf Level 1 (Node Root "NOC / Core Backbone Network" terhubung dengan edge ke masing-masing Node POP).
  - `sites` (`&popId=X`): Mengembalikan graf Level 2 (Node POP X di atas terhubung dengan edge ke masing-masing Node Customer Site anaknya, serta node Internal POP).
  - `devices` (`&siteId=Y` atau `&popId=X&isInternalOnly=true`): Mengembalikan graf Level 3 (Node perangkat fisik di site Y beserta edges koneksi kabel port yang terhubung).
  - Default (tanpa `level`): Mengembalikan graf datar seluruh perangkat untuk backward-compatibility dan pengujian regresi.

### 2.2 Custom Nodes pada Kanvas React Flow
1. **`rootNode`**: Simpul utama (NOC Pusat / Internet Backbone) dengan ikon 🌐 / ☁️.
2. **`popNode`**: Simpul Level 1 untuk POP (Ikon 🏢, Kode POP, Nama POP, Kota, Jumlah Customer, Total Perangkat, dan tombol/indikator *"Masuk ke Site Pelanggan →"*).
3. **`siteNode`**: Simpul Level 2 untuk Customer Site (Ikon 👥, Kode Site, Nama Customer, Kota, Jumlah Perangkat, dan tombol/indikator *"Lihat Perangkat & Kabel →"*).
4. **`deviceNode`**: Simpul Level 3 untuk Perangkat Jaringan (Ikon kategori, Hostname, Kode Perangkat, IP Manajemen, Status Inventaris).

### 2.3 Kontrol Navigasi & Breadcrumb Kanvas
- Breadcrumb interaktif di atas kanvas:
  - Level 1: `🌐 NOC Pusat / Seluruh POP`
  - Level 2: `🌐 NOC Pusat / 📍 [Nama POP]` dengan tombol `← Kembali ke Level POP`
  - Level 3: `🌐 NOC Pusat / 📍 [Nama POP] / 👥 [Nama Customer]` dengan tombol `← Kembali ke Daftar Site`
- Tombol Switcher Mode:
  - Tab 1: **"🗂️ Navigasi Graf Bertingkat (POP → Site → Perangkat)"** (Aktif default)
  - Tab 2: **"🌐 Topologi Global (Semua Perangkat Sekaligus)"** (Untuk melihat seluruh perangkat tanpa drill-down)

---

## 3. Kriteria Keberhasilan (DoD)
1. Di awal kanvas React Flow, tampil node Pusat dengan panah ke node-node POP.
2. Klik node POP mengubah tampilan kanvas ke graf Site Pelanggan di bawah POP tersebut.
3. Klik node Site Pelanggan mengubah tampilan kanvas ke graf perangkat & relasi koneksi kabel port fisik di site tersebut.
4. Breadcrumb dan tombol kembali berfungsi mulus di setiap level.
5. Klik node perangkat di Level 3 menampilkan detail perangkat, dan klik edge menampilkan dua port terhubung (DoD T7.1).
6. Tidak ada label status palsu up/down/online/offline (DoD T7.1).
7. Simpan & muat posisi layout tetap berfungsi per scope (DoD T7.2).
8. Seluruh pengujian otomatis dan uji regresi lolos 100%.
