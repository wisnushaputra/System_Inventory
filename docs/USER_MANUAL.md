# Buku Manual Pengguna (User Manual)
## Network Inventory Management System (NIMS)

---

## 📖 Daftar Isi
1. [Pendahuluan & Akses Sistem](#1-pendahuluan--akses-sistem)
2. [Navigasi & Tata Letak Antarmuka](#2-navigasi--tata-letak-antarmuka)
3. [Manajemen Inventaris Perangkat](#3-manajemen-inventaris-perangkat)
4. [Manajemen Port & Batch Generator](#4-manajemen-port--batch-generator)
5. [Manajemen Alamat IP (IPAM)](#5-manajemen-alamat-ip-ipam)
6. [Pencatatan Relasi & Konektivitas Jaringan](#6-pencatatan-relasi--konektivitas-jaringan)
7. [Visualisasi Topologi Interaktif](#7-visualisasi-topologi-interaktif)
8. [Manajemen Berkas Lampiran Privat](#8-manajemen-berkas-lampiran-privat)
9. [Impor Data Massal Berkas CSV](#9-impor-data-massal-berkas-csv)
10. [Ekspor Laporan & Proteksi Spreadsheet](#10-ekspor-laporan--proteksi-spreadsheet)
11. [Penelusuran Jejak Audit (Audit Trail)](#11-penelusuran-jejak-audit-audit-trail)

---

## 1. Pendahuluan & Akses Sistem

NIMS adalah portal aplikasi inventaris jaringan terpusat untuk Network Operation Center (NOC). Aplikasi ini dapat diakses menggunakan peramban web modern (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari) melalui alamat intranet atau server perusahaan:
- **URL Aplikasi:** `http://localhost:3000` (atau IP/Domain server yang ditentukan).

### Prosedur Masuk (Login):
1. Buka URL NIMS pada peramban web.
2. Masukkan **Username** dan **Password** resmi yang diberikan administrator.
3. Klik tombol **"Masuk ke Sistem"**.
4. Sistem menerapkan pembatasan keamanan: Jika salah memasukkan password sebanyak **5 kali berturut-turut**, akses akun dari alamat IP tersebut akan **diblokir sementara selama 15 menit** (`HTTP 429 Too Many Requests`).

### Prosedur Keluar (Logout):
- Klik tombol **"Keluar"** di pojok kanan atas bilah navigasi. Sesi login akan dihapus secara aman.

---

## 2. Navigasi & Tata Letak Antarmuka

Bilah navigasi atas (*top navbar*) menyajikan menu utama sesuai hak akses peran pengguna:
- **Dashboard**: Ringkasan statistik perangkat, site, subnet, koneksi, dan kartu audit data belum lengkap.
- **Perangkat**: Manajemen daftar inventaris perangkat jaringan, form pendaftaran, impor CSV, dan ekspor CSV.
- **Topologi**: Kanvas grafik interaktif visualisasi hubungan kabel dan perangkat jaringan.
- **Master Data**: Manajemen referensi Site/POP, Ruangan Server, Rak, Vendor, Kategori, dan Model.
- **Audit Log** *(Khusus Admin, Supervisor, Auditor)*: Catatan kronologis seluruh perubahan data sistem beserta peninjau *diff*.

---

## 3. Manajemen Inventaris Perangkat

### 3.1 Navigasi Inventaris Perangkat (Hierarki POP -> Customer -> Perangkat)
Halaman Inventaris Perangkat (`/devices`) mendukung navigasi bertingkat intuitif dan pencarian global:

1. **Mode Navigasi Hierarki (Default):**
   - **Level 1 (Pilih POP):** Halaman depan menampilkan kartu-kartu Point of Presence (POP) utama beserta metrik ringkasan (jumlah site pelanggan dan total perangkat). Klik kartu POP yang diinginkan.
   - **Level 2 (Pilih Customer / Site Pelanggan):** Menampilkan daftar Site Pelanggan di bawah POP terpilih beserta jumlah perangkat aktif masing-masing. Operator juga dapat beralih ke sub-tab *"Perangkat Internal POP"* untuk melihat router/switch core yang terpasang di ruangan POP tersebut.
   - **Level 3 (Daftar Perangkat):** Menampilkan tabel lengkap perangkat yang terpasang pada customer site tersebut (kode aset, hostname, IP manajemen, serial number, status, aksi detail/arsip). Dilengkapi tombol cepat *"+ Tambah Perangkat ke Site Ini"* yang otomatis mengisi lokasi site.
   - **Breadcrumb Navigation:** Jalur navigasi di bagian atas (`Semua POP / [Nama POP] / [Nama Customer]`) memudahkan operator berpindah level kapan saja dengan satu klik.

2. **Mode Semua Perangkat (Tabel Global):**
   - Klik tab **"Semua Perangkat (Tabel Global)"** di bagian atas untuk melihat seluruh perangkat dalam satu tabel flat.
   - Gunakan bilah pencarian global untuk mencari perangkat berdasarkan **Hostname**, **Kode Perangkat**, **Serial Number**, atau **IP Manajemen** lintas-POP.
   - Gunakan filter dropdown untuk menyaring berdasarkan **Kategori** (Router, Switch, OLT, dll), **Vendor**, **Lokasi Site**, **Status**, atau **Role Jaringan**.
   - Opsi **"Tampilkan Terarsip"** untuk melihat perangkat yang dinonaktifkan.

### 3.2 Menambah Perangkat Baru
1. Klik tombol **"+ Tambah Perangkat"** di kanan atas halaman inventaris.
2. Lengkapi formulir pendaftaran:
   - **Kode Perangkat (Wajib)**: Masukkan kode aset unik (misal `RTR-BDG-001`). Sistem otomatis menolak jika kode sudah terdaftar.
   - **Hostname (Wajib)**: Nama host jaringan (misal `cr01.bdg.isp.net.id`).
   - **Kategori & Vendor (Wajib)**: Pilih dari dropdown master data.
   - **Model (Opsional)**: Pilih tipe model perangkat yang sesuai dengan vendor terpilih.
   - **Site/Lokasi (Wajib)**: Pilih lokasi POP tempat perangkat beroperasi.
   - **Ruangan & Rak (Opsional)**: Tentukan penempatan fisik perangkat pada ruangan dan rak server.
   - **Nomor Seri / Serial Number (Opsional)**: Nomor seri perangkat dari pabrikan.
   - **Role Jaringan & Status**: Pilih peran (`core`, `distribution`, `access`, dll) dan status (`ACTIVE`, `PLANNED`, dll).
3. Klik tombol **"Simpan Perangkat"**.

### 3.3 Mengedit Data & Proteksi Concurrency (Optimistic Locking)
1. Buka halaman detail perangkat yang ingin diubah, lalu klik **"Edit Perangkat"**.
2. Ubah data yang diinginkan, kemudian klik **"Simpan Perubahan"**.
3. **Peringatan Benturan Data (Optimistic Locking):** Jika ada rekan operator lain yang menyimpan perubahan pada perangkat yang sama saat formulir Anda masih terbuka, sistem akan menolak penyimpanan dengan notifikasi:
   > *"Konflik pembaruan (Optimistic Locking): Data perangkat ini telah diperbarui oleh pengguna/sesi lain. Silakan muat ulang halaman untuk mendapatkan data terbaru."*
   Hal ini menjamin data terbaru rekan Anda tidak tertimpa secara tidak sengaja (*mencegah lost update*). Muat ulang halaman, periksa data terbaru, lalu lakukan pengeditan kembali.

### 3.4 Mengarsipkan & Memulihkan Perangkat
- **Mengarsipkan Perangkat:** Pada halaman detail perangkat, klik tombol **"Arsipkan Perangkat"**, masukkan alasan penonaktifan (contoh: *"Perangkat rusak diganti unit baru"*), lalu konfirmasi. Perangkat tidak akan dihapus fisik dari database, melainkan disembunyikan dari daftar aktif operasional.
- **Memulihkan Perangkat (Restore):** Buka daftar perangkat terarsip, buka detail perangkat terkait, lalu klik **"Pulihkan Perangkat"**. Perangkat akan kembali aktif seperti semula.

---

## 4. Manajemen Port & Batch Generator

Port atau antarmuka fisik/logis dikelola langsung pada halaman detail perangkat di tab **"Port & Antarmuka"**.

### 4.1 Menambah Port Satuan
1. Pada tab Port, klik **"Tambah Port"**.
2. Masukkan **Nama Port** (contoh: `GigabitEthernet0/0/1` atau `sfp-plus1`).
3. Tentukan **Tipe Port** (`ethernet`, `sfp`, `pon`, dll) dan **Media Transmisi** (`copper`, `fiber_single_mode`, dll).
4. Klik simpan. Sistem otomatis memvalidasi bahwa tidak boleh ada dua port dengan nama yang sama pada satu perangkat.

### 4.2 Pembuat Port Massal (Batch Port Generator)
Untuk switch atau router dengan banyak port (misal switch 24 port):
1. Klik tombol **"⚡ Buat Port Massal"**.
2. Masukkan **Pola Prefix Nama Port** (misal: `ge-0/0/` atau `eth`).
3. Masukkan **Nomor Awal** (misal: `1`) dan **Nomor Akhir** (misal: `24`).
4. Pilih Tipe Port dan Media Transmisi.
5. Klik **"Generate Port"**. Sistem akan membuat ke-24 port sekaligus secara instan dalam satu transaksi database yang aman.

---

## 5. Manajemen Alamat IP (IPAM)

Modul IPAM mengelola alokasi alamat IP secara disiplin dan mencegah tumpang tindih.

### 5.1 Menambah Subnet
1. Buka menu IPAM, klik **"Tambah Subnet"**.
2. Masukkan nama subnet (contoh: `Subnet Management POP Bandung`) dan notasi CIDR (contoh: `10.10.10.0/24`).
3. Sistem secara otomatis menghitung bitwise prefix, subnet mask, usable IP range (`10.10.10.1 - 10.10.10.254`), total host, serta otomatis memblokir alokasi host pada alamat Network (`10.10.10.0`) dan Broadcast (`10.10.10.255`).

### 5.2 Mengalokasikan Management IP ke Perangkat
1. Pada halaman detail perangkat, buka panel Alamat IP / IPAM.
2. Klik **"Tetapkan IP Manajemen"**.
3. Pilih Subnet penampung dan masukkan alamat IP host yang diinginkan.
4. Sistem memeriksa apakah IP tersebut sudah dipakai oleh perangkat lain. Jika belum, IP akan dialokasikan dengan status `ALLOCATED` dan otomatis muncul sebagai Management IP resmi perangkat tersebut di seluruh tabel dan topologi.

### 5.3 Melepaskan IP (Release)
- Jika perangkat ditarik atau diganti IP-nya, klik tombol **"Lepas IP"**. Status IP akan berubah menjadi `RELEASED` dan riwayat alokasi tetap tercatat di log audit.

---

## 6. Pencatatan Relasi & Konektivitas Jaringan

Modul relasi jaringan mencatat kabel dan jalur transmisi antarperangkat.

### 6.1 Membuat Koneksi Antarperangkat
1. Buka tab **"Koneksi Jaringan"** pada salah satu perangkat, klik **"+ Tambah Koneksi"**.
2. Pilih port lokal pada perangkat ini (**Endpoint A**).
3. Pilih perangkat lawan pada daftar pencarian, lalu pilih port lawan (**Endpoint B**).
4. Pilih **Tipe Relasi** (`physical`, `logical`, `parent_child`, `service`) dan **Media** (`fiber`, `copper`, `wireless`).
5. Masukkan estimasi kapasitas link (misal `1000` untuk 1 Gbps) dan label kabel jika ada.
6. Klik **"Simpan Relasi"**.

### 6.2 Aturan Integritas Koneksi
Sistem menerapkan 3 aturan validasi ketat:
1. **Dilarang Loop Sendiri:** Anda tidak dapat menghubungkan port ke port yang sama pada perangkat yang sama ($A \neq B$).
2. **Anti-Duplikasi A-B dan B-A:** Jika Port 1 terhubung ke Port 2, Anda tidak dapat membuat koneksi kedua dari Port 2 ke Port 1.
3. **Satu Port Fisik Aktif:** Satu port fisik hanya boleh dipasangi satu kabel fisik aktif pada saat yang sama.

---

## 7. Visualisasi Topologi Interaktif

Buka menu **"Topologi"** (`/topology`) untuk melihat representasi grafis jaringan.

### 7.1 Fitur Kanvas React Flow: Graf Bertingkat (In-Canvas Drill-Down)
Halaman Topologi (`/topology`) menyajikan visualisasi graf interaktif multi-level:

1. **Level 1 (Topologi POP Global):**
   - Di awal, kanvas React Flow menampilkan simpul **NOC / Core Backbone Network** di bagian atas, yang bercabang dengan garis transmisi ke masing-masing simpul **POP (Point of Presence)**.
   - Setiap kotak simpul POP menampilkan kode site, kota, jumlah customer site, dan total perangkat.
   - **Interaksi:** Klik pada salah satu kotak simpul POP untuk melakukan *drill-down* masuk ke level berikutnya.

2. **Level 2 (Topologi Site Pelanggan di bawah POP):**
   - Kanvas memperbarui graf dengan menampilkan simpul POP Induk di atas yang bercabang ke simpul-simpul **Site Pelanggan (Customer Sites)** dan simpul infrastruktur internal POP.
   - Setiap kotak simpul pelanggan menampilkan nama customer, kode, alamat, dan jumlah perangkat.
   - **Interaksi:** Klik pada salah satu kotak simpul Customer Site untuk melihat topologi perangkatnya.

3. **Level 3 (Topologi & Daftar Perangkat di Site Terpilih):**
   - Kanvas menampilkan graf perangkat nyata (Router, Switch, Firewall) beserta jalur kabel dan port yang terhubung aktif di site tersebut.
   - Tepat di bawah kanvas, disajikan tabel daftar perangkat lengkap di site tersebut beserta link detail dan tombol tambah perangkat.
   - **Inspeksi Node:** Klik kotak perangkat untuk membuka panel spesifikasi di sisi kanan.
   - **Inspeksi Edge:** Klik garis kabel koneksi untuk membuka panel rincian port kedua ujung (Endpoint A & Endpoint B), kapasitas link, dan media transmisi.

4. **Navigasi Breadcrumb & Tombol Kembali:**
   - Bilah navigasi di atas kanvas (`🌐 NOC Pusat / 📍 [Nama POP] / 👥 [Nama Customer]`) memudahkan operator melompat ke tingkat mana pun secara instan.
   - Tersedia tombol cepat `← Kembali ke Level POP` dan `← Kembali ke Daftar Site Pelanggan`.

5. **Mode Alternatif (Topologi Global):**
   - Operator dapat berpindah ke tab **"🌐 Topologi Global (Semua Perangkat)"** untuk melihat seluruh perangkat dalam satu diagram datar tanpa drill-down.
   - Fitur **"🔄 Rapikan Posisi"** dan **"💾 Simpan Layout"** tetap aktif di seluruh level dan terisolasi per akun operator.

---

## 8. Manajemen Berkas Lampiran Privat

Dokumen teknis seperti backup konfigurasi router (`.cfg`), diagram perijinan (`.pdf`), atau foto rak dapat dilampirkan langsung pada perangkat:
1. Buka halaman detail perangkat, pilih tab **"Dokumen"**.
2. Klik **"Unggah Dokumen"**, pilih berkas dari komputer Anda, isi judul dan deskripsi.
3. **Ketentuan Keamanan Berkas:**
   - Format yang didukung: Dokumen PDF, teks konfigurasi (`.txt`, `.cfg`), spreadsheet (`.xlsx`, `.csv`), gambar (`.jpg`, `.png`).
   - Berkas berisiko seperti `.svg` dan `.html` **ditolak mentah-mentah** oleh server untuk mencegah serangan Cross-Site Scripting (XSS).
   - Seluruh berkas disimpan dalam penyimpanan privat terenkripsi di server (tidak memiliki URL publik terbuka).
4. **Mengunduh Berkas:** Klik tombol **"Unduh"**. Sistem akan memverifikasi izin Anda, mencatat aktivitas unduhan ke audit log, dan menyajikan berkas dengan header proteksi unduhan `attachment` serta `nosniff`.

---

## 9. Impor Data Massal Berkas CSV

Untuk memasukkan puluhan atau ratusan perangkat sekaligus dari data spreadsheet lama:

1. Buka halaman **"Perangkat"**, lalu klik tombol **"📤 Impor CSV"** (atau buka `/devices/import`).
2. Klik tombol **"Unduh Template CSV"** untuk mendapatkan format berkas resmi berstandar PRD §19.3.
3. Buka template tersebut menggunakan aplikasi spreadsheet (Microsoft Excel, LibreOffice Calc, atau Google Sheets), lalu isi baris data:
   - Kolom wajib: `device_code`, `hostname`, `category`, `vendor`, `site_code`.
   - Kolom opsional: `model`, `serial_number`, `management_ip`, `network_role`, `inventory_status`, `description`.
4. Simpan berkas sebagai format `.csv` (UTF-8).
5. Tarik dan lepas (*drag-and-drop*) berkas CSV Anda ke area unggah, lalu klik **"Pratinjau & Validasi Data"**.
6. **Pemeriksaan Pratinjau (Preview Mode):**
   - Sistem menampilkan tabel pratinjau data valid berwarna hijau.
   - Jika ada kesalahan (misal: kode kategori fiktif, kode site tidak ditemukan, format IP salah, atau kode perangkat duplikat), baris yang bermasalah akan dicatat dalam tabel laporan merah lengkap dengan **nomor baris fisik berkas CSV** dan alasan penolakannya.
7. **Eksekusi Parsial:** Klik **"Konfirmasi & Simpan"**. Baris-baris data yang valid akan disimpan ke basis data, sedangkan baris yang error dilewati tanpa menggagalkan baris valid lainnya.
8. Sistem menampilkan laporan ringkasan hasil impor (total, jumlah berhasil, jumlah gagal) dan mencatatnya ke jejak audit log.

---

## 10. Ekspor Laporan & Proteksi Spreadsheet

### 10.1 Mengekspor Data
- **Ekspor Daftar Perangkat:** Pada halaman `/devices`, terapkan filter yang Anda inginkan (misal hanya Site Bandung dan Status ACTIVE), lalu klik **"📥 Ekspor CSV"**. Sistem akan mengunduh berkas CSV berisi seluruh perangkat yang sesuai filter tersebut.
- **Ekspor Audit Log:** Pada halaman `/audit-logs`, klik **"📥 Ekspor CSV"** untuk mengunduh log audit aktivitas.

### 10.2 Proteksi Formula Injection (CWE-1236)
NIMS dilengkapi perlindungan keamanan formula injection otomatis: jika ada nama host, deskripsi, atau serial number yang diawali oleh karakter formula berbahaya seperti `=`, `+`, `-`, atau `@`, sistem otomatis menambahkan tanda kutip tunggal (`'`) di depan karakter tersebut saat diekspor. Hal ini memastikan berkas CSV aman dibuka di Microsoft Excel tanpa risiko penyerang mengeksekusi perintah makro jahat.

---

## 11. Penelusuran Jejak Audit (Audit Trail)

Halaman **Audit Log** (`/audit-logs`) menyajikan jejak rekam digital seluruh peristiwa di sistem:
1. **Filter Audit:** Cari aktivitas berdasarkan Nama Pengguna, Tipe Entitas (Device, User, Connection, Document, dll), Jenis Aksi (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, LOGIN, EXPORT, IMPORT), serta Rentang Tanggal.
2. **Peninjau Diff (Before vs After):** Klik tombol **"Lihat Diff"** pada aksi pembaruan (`UPDATE`) untuk melihat perbandingan data sebelum dan sesudah perubahan secara berdampingan dengan penanda warna yang jelas. Seluruh password dan kunci rahasia otomatis disamarkan (`[REDACTED]`).
