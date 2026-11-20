# PANDUAN SLIDE PRESENTASI & DEMO SIDANG KERJA PRAKTIK

## Topik: Rancang Bangun Sistem Manajemen Inventaris Jaringan dan Topologi Terpusat Berbasis RBAC pada NOC ISP (NIMS)
**Presenter:** Mahasiswa Kerja Praktik  
**Audiens:** Dosen Pembimbing, Dosen Penguji, & Pembimbing Lapangan ISP  
**Struktur Presentasi:** Masalah $\to$ Desain Solusi $\to$ Demo Fitur Utama $\to$ Evaluasi KPI PRD §2.3  

---

### SLIDE 1: JUDUL & IDENTITAS
- **Judul Proyek:** Rancang Bangun Network Inventory Management System (NIMS) untuk Network Operation Center ISP
- **Sub-judul:** Solusi Manajemen Inventaris, IPAM, Topologi Relasi, dan Kontrol Konkurensi Berbasis Role-Based Access Control
- **Presenter:** [Nama Mahasiswa] / [NIM]
- **Tempat Kerja Praktik:** PT. Internet Service Provider Indonesia (Divisi Network Operation Center)
- **Pembimbing Lapangan & Dosen Pembimbing:** [Nama Pembimbing]

> 🗣️ **Speaker Notes (Talking Points):**
> *"Selamat pagi/siang Bapak/Ibu Dewan Penguji dan Pembimbing. Pada kesempatan kali ini, saya akan mempresentasikan hasil Kerja Praktik saya mengenai perancangan dan implementasi Network Inventory Management System (NIMS) yang dikembangkan untuk mengatasi permasalahan operasional pada Network Operation Center ISP."*

---

### SLIDE 2: LATAR BELAKANG & PERMASALAHAN RIIL (MASALAH)
- **Kondisi Awal di Lapangan:**
  - Pencatatan inventaris perangkat dan relasi kabel masih menggunakan **file spreadsheet manual (Excel/Google Sheets)** yang terpisah antar-tim (Core, Distribusi, Akses).
- **Dampak Masalah:**
  1. **Konflik Lost Update:** Ketika dua operator NOC mengedit berkas bersamaan, perubahan operator pertama tertimpa tanpa peringatan.
  2. **Ketiadaan Validasi Integritas Relasi:** Banyak terjadi kesalahan input: kabel terhubung ke port yang sama (*loop*), satu port fisik dipasangi dua koneksi aktif, atau alamat IP bentrok (*duplicate IP conflict*).
  3. **Dokumen Konfigurasi Tersebar Bebas:** Backup konfigurasi (`.cfg`) dan diagram topologi disimpan di laptop teknisi atau dikirim lewat chat tanpa enkripsi.
  4. **Ketiadaan Jejak Audit:** Tidak ada pencatatan digital siapa yang mengubah data perangkat, kapan waktu perubahan, dan nilai sebelum diubah.
  5. **MTTR Tinggi:** Waktu identifikasi perangkat lawan saat kabel putus memakan waktu 15–30 menit mencari di spreadsheet.

> 🗣️ **Speaker Notes:**
> *"Di lingkungan ISP yang dinamis, spreadsheet tidak lagi memadai. Masalah paling fatal adalah terjadinya 'lost update' saat pergantian shift dan kesalahan alokasi IP ganda yang bisa memicu gangguan jaringan pelanggan korporasi. Oleh karena itu, dibutuhkan sebuah platform terpusat yang memiliki aturan integritas data yang ketat."*

---

### SLIDE 3: SOLUSI YANG DITAWARKAN (NIMS)
- **Tujuan Sistem:** Membangun platform terpusat *Single Source of Truth* untuk operasional NOC ISP.
- **5 Pilar Kemampuan Utama NIMS:**
  1. **Integritas Relasi Jaringan:** Penegakan aturan DB $A \neq B$, anti-duplikat A-B/B-A, dan pembatasan satu kabel per port fisik aktif.
  2. **IPAM Dasar Terintegrasi:** Kalkulasi otomatis prefix IPv4 CIDR, pemblokiran otomatis alokasi host pada network & broadcast IP.
  3. **Optimistic Concurrency Control:** Pencegahan *lost update* dengan nomor versi record.
  4. **Visualisasi Topologi Interaktif (@xyflow/react):** Peta graf relasi perangkat interaktif dengan tata letak mandiri per user.
  5. **Keamanan Enterprise:** Proteksi formula injection (CWE-1236), rate limiting login, penyimpanan privat dokumen, dan jejak audit lengkap.

---

### SLIDE 4: ARSITEKTUR TEKNOLOGI SISTEM
- **Frontend & Fullstack Framework:** Next.js 16 (App Router) + React 19 + TypeScript.
- **Styling:** Tailwind CSS v4 (Modern, responsif untuk layar NOC).
- **Database Relasional:** PostgreSQL 18 (ACID compliant).
- **Object-Relational Mapping (ORM):** Prisma ORM 6.19 (Type-safe & Parameterized Queries anti-SQL Injection).
- **Autentikasi & Keamanan:** `iron-session` (Enkripsi cookie HttpOnly), `node:crypto.scrypt` (Password hashing), in-memory rate limiter.
- **Visual Graf:** `@xyflow/react` (React Flow).

```text
[ Browser Client / NOC Operator ]
       │  (HTTPS, HttpOnly Cookie, Origin Check)
       ▼
[ Next.js 16 App Router (Node.js) ]
  ├── Server Components (SSR, RBAC requirePermission)
  ├── Route Handlers / API (Zod Validation, Rate Limiter)
  ├── Audit Logging Engine (Sanitasi Password Redacted)
  └── Private Storage Manager (UUID, MIME Whitelist)
       │  (Parameterized SQL Queries)
       ▼
[ PostgreSQL 18 Database Engine ]
  └── 17 Normalized Relational Tables (Constraints, FKs, Indexes)
```

---

### SLIDE 5: DESAIN BASIS DATA (ERD FINAL)
- Basis data dinormalisasi hingga 3NF dengan **17 tabel entitas relasional**:
  - **Manajemen Akses:** `users`, `roles`, `permissions`, `role_permissions`.
  - **Spasial & Penempatan:** `sites`, `rooms`, `racks`.
  - **Katalog Perangkat:** `vendors`, `device_categories`, `device_models`.
  - **Topologi & Jaringan:** `devices`, `interfaces`, `network_connections`.
  - **IPAM:** `subnets`, `ip_addresses`.
  - **Keamanan & Dukungan:** `documents`, `audit_logs`, `topology_layouts`.
- **Integritas Tingkat Database:**
  - Foreign key constraints dengan proteksi `RESTRICT` pada data master (mencegah penghapusan tak sengaja jika masih memiliki perangkat aktif).
  - Indeks pada kolom pencarian: `hostname`, `deviceCode`, `serialNumber`, `cidr`, `address`.

---

### SLIDE 6: KONTROL HAK AKSES BERBASIS PERAN (RBAC)
- Memisahkan wewenang (*Separation of Duties*) menjadi 5 Peran Utama:
  1. **Admin:** Akses penuh seluruh sistem, manajemen user, dan master data.
  2. **Network Engineer:** Mengelola inventaris, IPAM, dokumen teknis, dan ekspor.
  3. **Operator NOC:** Hak akses operasional harian: melihat perangkat, memperbarui port, dan mengedit data perangkat (tidak memiliki hak arsip massal, ekspor, atau melihat audit log).
  4. **Supervisor:** Hak peninjauan menyeluruh (*read-only*), ekspor laporan, dan audit log.
  5. **Auditor:** Hak audit keamanan dan peninjauan riwayat perubahan.
- **Penegakan:** Setiap akses ilegal ditolak `HTTP 403 Forbidden` dan dicatat ke log audit dengan aksi `ACCESS_DENIED`.

---

### SLIDE 7: SKENARIO DEMO 1 — MANAJEMEN PERANGKAT & OPTIMISTIC LOCKING
*(Sesi Demonstrasi Langsung)*
- **Langkah Demo:**
  1. Menampilkan daftar perangkat `/devices` dengan filter dinamis dan pencarian instan.
  2. Membuka formulir tambah perangkat `/devices/new` dan mendaftarkan router baru.
  3. Menguji validasi: Memasukkan kode perangkat duplikat $\to$ Sistem menolak dengan `HTTP 409 Conflict`.
  4. **Uji Optimistic Locking:**
     - Tab 1 dan Tab 2 membuka perangkat yang sama.
     - Tab 2 mengubah hostname dan menyimpan $\to$ Berhasil, versi perangkat naik dari 1 ke 2.
     - Tab 1 mencoba menyimpan form versi 1 yang usang $\to$ **Ditolak oleh sistem dengan pesan konflik konkurensi (Lost update dicegah 100%)**.

---

### SLIDE 8: SKENARIO DEMO 2 — BATCH PORT GENERATOR & IPAM DINAMIS
*(Sesi Demonstrasi Langsung)*
- **Langkah Demo:**
  1. Membuka detail perangkat router, memilih tab **"Port & Antarmuka"**.
  2. Menjalankan **Batch Port Generator**: Memasukkan prefix `ge-0/0/`, nomor 1 s.d. 24 $\to$ Ke-24 port dibuat sekaligus dalam 1 detik.
  3. Menguji aturan port duplikat: Menambahkan port dengan nama yang sama $\to$ Ditolak database.
  4. Membuka modul **IPAM**: Menampilkan subnet `10.50.0.0/24`.
  5. Mengalokasikan IP manajemen `10.50.0.10` ke perangkat.
  6. Menguji validasi host: Mengalokasikan IP `10.50.0.0` (network) atau `10.50.0.255` (broadcast) $\to$ Ditolak dengan pesan validasi bitwise yang jelas.
  7. IP manajemen otomatis terhubung dan tampil dinamis di inventaris tanpa duplikasi kolom.

---

### SLIDE 9: SKENARIO DEMO 3 — INTEGRITAS RELASI & TOPOLOGI KANVAS
*(Sesi Demonstrasi Langsung)*
- **Langkah Demo:**
  1. Membuka tab **"Koneksi Jaringan"**, menghubungkan Router Core ke Switch Distribusi.
  2. Menguji aturan integritas relasi:
     - Menghubungkan port ke port yang sama $\to$ Ditolak ($A \neq B$).
     - Membuat koneksi duplikat B-A $\to$ Ditolak (Anti-duplikat).
     - Memasangi port fisik yang sudah terhubung dengan kabel kedua $\to$ Ditolak (Satu kabel aktif per port).
  3. Membuka halaman **Topologi Interaktif** (`/topology`):
     - Kanvas graf React Flow merender node perangkat dan garis koneksi secara visual.
     - Klik node: Muncul detail lengkap perangkat di sidebar kanan.
     - Klik edge: Muncul detail kedua port yang saling tersambung.
     - Menekan tombol **"Rapikan Posisi"** (Auto-layout).
     - Menggeser posisi node dan menekan **"Simpan Posisi"** (Posisi tersimpan persisten khusus akun pengguna tersebut).

---

### SLIDE 10: SKENARIO DEMO 4 — PENYIMPANAN DOKUMEN & EKSPOR AMAN
*(Sesi Demonstrasi Langsung)*
- **Langkah Demo:**
  1. Mengunggah file konfigurasi router (`backup-router.cfg`) pada tab dokumen perangkat.
  2. Memperlihatkan bahwa file tersimpan di storage privat dengan nama acak UUID dan hash SHA-256.
  3. Menguji penolakan file berbahaya: Mengunggah file `.svg` atau `.html` $\to$ Ditolak `HTTP 400 Bad Request`.
  4. Mengunduh file $\to$ Disajikan dengan header `Content-Disposition: attachment` dan `X-Content-Type-Options: nosniff`.
  5. Mengekspor data perangkat ke CSV $\to$ Menguji proteksi **Formula Injection (CWE-1236)**: Karakter `=`, `+`, `-`, `@` otomatis di-escape sehingga aman saat dibuka di Excel.

---

### SLIDE 11: SKENARIO DEMO 5 — IMPOR CSV MASSAL PRD §19.3
*(Sesi Demonstrasi Langsung)*
- **Langkah Demo:**
  1. Mengunduh template resmi CSV dari tombol **"Unduh Template CSV"**.
  2. Mengunggah file CSV uji berisi 10 baris data (8 valid, 2 error: kategori ngawur & site gaib).
  3. Menampilkan **Pratinjau (Preview)**:
     - 8 baris valid tampil di tabel hijau siap simpan.
     - 2 baris bermasalah dilaporkan di tabel merah lengkap dengan **nomor baris fisik** file CSV dan penyebab errornya.
  4. Menekan **"Konfirmasi & Simpan"** $\to$ Eksekusi parsial berhasil: Tepat 8 perangkat tersimpan di database, 2 baris error ditolak dan dicatat di log audit.

---

### SLIDE 12: SKENARIO DEMO 6 — AUDIT LOG & DIFF VIEWER
*(Sesi Demonstrasi Langsung)*
- **Langkah Demo:**
  1. Membuka halaman **Audit Log** (`/audit-logs`).
  2. Menyaring aktivitas berdasarkan aksi `UPDATE` dan entitas `Device`.
  3. Menekan tombol **"Lihat Diff"**:
     - Sistem menampilkan perbandingan data sebelum (*beforeData*) dan sesudah (*afterData*) berdampingan dengan penanda warna merah/hijau.
     - Menunjukkan bahwa data sensitif (password/token) otomatis disanitasi menjadi `[REDACTED]`.
  4. Login sebagai `operator` dan mencoba membuka `/audit-logs` $\to$ Akses ditolak `HTTP 403`, insiden `ACCESS_DENIED` tercatat di audit log admin.

---

### SLIDE 13: HASIL PENGUJIAN PERFORMA BEBAN SKALA BESAR
- **Dataset Skala Penuh:** **2.000 Perangkat, 20.000 Port, dan 50.000 Alamat IP**.
- **Hasil Pengujian terhadap Target PRD §11.2:**

| Pengujian | Target PRD §11.2 | Hasil Terukur | Keterangan |
|---|:---:|:---:|:---:|
| **Load Daftar Perangkat (Limit 20)** | $\le$ 3.000 ms | **105 ms** | **28x Lebih Cepat** |
| **Pencarian Hostname / Kode** | $\le$ 2.000 ms | **47 ms** | **42x Lebih Cepat** |
| **Filter Kategori / Status** | $\le$ 2.000 ms | **22 ms** | **90x Lebih Cepat** |
| **Efisiensi Memori (Memory Safety)** | Pagination Aktif | **Tepat 50 data/page** | **Bebas OOM** |

> 🗣️ **Speaker Notes:**
> *"Bapak/Ibu penguji, sistem diuji bukan hanya dengan data kosong, melainkan dengan data skala produksi: 2.000 perangkat, 20.000 port, dan 50.000 IP. Seluruh response time berada di bawah 110 ms, membuktikan efektivitas indexing PostgreSQL dan pagination Next.js."*

---

### SLIDE 14: EVALUASI PENCAPAIAN 7 KPI PRD §2.3
- **Hasil Evaluasi Akhir Proyek:**

| No | Indikator Keberhasilan (KPI §2.3) | Target Awal | Capaian Nyata | Status |
|---|---|:---:|:---:|:---:|
| 1 | Kelengkapan Data Perangkat Wajib | $\ge$ 95% | **100%** | **TERLAMPAUI** |
| 2 | Keberhasilan Pencarian Perangkat | $\ge$ 95% | **100%** | **TERLAMPAUI** |
| 3 | Keberhasilan Ekspor CSV Aman | 100% | **100%** | **LULUS** |
| 4 | Pencatatan Perubahan (Audit Trail) | 100% | **100%** | **LULUS** |
| 5 | Integritas Relasi Jaringan | 0 Orphan Link | **0 Orphan Link** | **LULUS** |
| 6 | Penegakan Hak Akses (RBAC) | 0 Unauthorized | **0 Kebocoran** | **LULUS** |
| 7 | Kemudahan Penggunaan Operasional | UAT Mandiri | **26 Skenario PASS** | **LULUS** |

---

### SLIDE 15: KESIMPULAN & KONTRIBUSI NYATA
- **Kesimpulan:**
  1. Aplikasi NIMS berhasil dibangun 100% dari Fase 0 hingga Fase 10 sesuai spesifikasi PRD.
  2. Masalah *lost update* antar-operator berhasil diselesaikan menggunakan *Optimistic Locking*.
  3. Integritas topologi kabel jaringan dan alokasi IPAM terjamin melalui validasi database dan algoritma bitwise CIDR.
  4. Keamanan data operasional ISP terpenuhi sesuai standar OWASP dan PRD §11.1 (Rate limit, CSRF, Formula Injection defense, Private storage).
- **Manfaat bagi Perusahaan:**
  - Waktu identifikasi perangkat saat insiden kabel putus terpangkas dari **15–30 menit menjadi < 1 menit**.
  - Risiko salah cabut kabel dan alokasi IP ganda tereliminasi.

---

### SLIDE 16: PENUTUP & TANYA JAWAB (Q&A)
- Terima kasih atas perhatian Bapak/Ibu Dosen Pembimbing, Penguji, dan Pembimbing Lapangan.
- **Sesi Tanya Jawab (Q&A) dibuka.**
- *Repositori Proyek & Dokumentasi Lengkap siap ditinjau.*
