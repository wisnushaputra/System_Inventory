# LAPORAN KERJA PRAKTIK

## RANCANG BANGUN SISTEM MANAJEMEN INVENTARIS JARINGAN DAN TOPOLOGI TERPUSAT BERBASIS ROLE-BASED ACCESS CONTROL PADA NETWORK OPERATION CENTER INTERNET SERVICE PROVIDER

---

## ABSTRAK
Operasional Network Operation Center (NOC) pada penyedia layanan internet (Internet Service Provider / ISP) sangat bergantung pada visibilitas dan akurasi data inventaris infrastruktur jaringan. Pada praktiknya, banyak ISP masih menggunakan dokumen spreadsheet terpisah yang rawan terhadap konflik perubahan bersamaan (*lost updates*), tidak memiliki validasi integritas relasi jaringan, tidak memiliki pelacakan audit riwayat perubahan, serta menyimpan kredensial dan dokumen konfigurasi secara tidak aman.

Untuk mengatasi permasalahan tersebut, Kerja Praktik ini mengembangkan **Network Inventory Management System (NIMS)**, sebuah aplikasi berbasis web modern yang dibangun menggunakan Next.js 16 (App Router), TypeScript, Prisma ORM, dan basis data PostgreSQL. NIMS mengintegrasikan manajemen inventaris perangkat multi-vendor, generator port antarmuka massal, IP Address Management (IPAM) dasar dengan kalkulasi bitwise CIDR, visualisasi topologi graf interaktif (@xyflow/react), kontrol konkurensi data (*optimistic locking*), impor data massal CSV dengan validasi baris fisik, ekspor data aman dari ancaman *formula injection* (CWE-1236), dan penegakan hak akses berbasis peran (*Role-Based Access Control / RBAC*).

Pengujian sistem dilakukan melalui uji otomatis integrasi, pengujian beban skala besar (2.000 perangkat, 20.000 port, dan 50.000 IP), dan pengujian penerimaan pengguna (UAT) terhadap 26 butir skenario fungsional P0 (*Must-Have*). Hasil evaluasi menunjukkan bahwa seluruh 7 Indikator Kinerja Utama (KPI PRD §2.3) tercapai dengan tingkat keberhasilan 100%, waktu muat daftar 2.000 perangkat hanya 105 ms (jauh di bawah ambang batas 3 detik), serta tidak ditemukan relasi jaringan yang terputus atau tidak konsisten.

**Kata Kunci:** *Network Inventory*, *IPAM*, *Optimistic Locking*, *RBAC*, *Topologi Jaringan*, *Next.js*, *PostgreSQL*, *NOC ISP*.

---

## BAB I: PENDAHULUAN

### 1.1 Latar Belakang Masalah
Dalam ekosistem penyedia layanan internet (ISP), Network Operation Center (NOC) bertindak sebagai pusat komando yang memantau ketersediaan link, menangani insiden putusnya kabel fiber optik, dan mengalokasikan kapasitas jaringan untuk pelanggan korporasi maupun ritel. Kecepatan penanganan gangguan (*Mean Time to Recovery / MTTR*) secara langsung ditentukan oleh seberapa cepat tim teknisi dapat mengetahui perangkat mana yang terdampak, di rak mana perangkat berada, port mana yang terhubung, dan kabel apa yang menjadi jalur cadangan.

Namun, observasi selama pelaksanaan Kerja Praktik menemukan sejumlah permasalahan mendasar pada tata kelola data operasional jaringan:
1. **Pencatatan Manual Terfragmentasi (Spreadsheet Silo):** Data perangkat, alokasi IP, dan relasi kabel dicatat dalam berkas Microsoft Excel atau Google Sheets yang terpisah antar-tim (tim Core, tim Akses, dan tim Helpdesk).
2. **Ketiadaan Validasi Integritas Topologi:** Format spreadsheet tidak mampu mencegah kesalahan manusia (*human error*), seperti mendaftarkan dua koneksi fisik aktif pada satu port yang sama, membuat koneksi yang menghubungkan port dengan dirinya sendiri (*looping*), atau alokasi alamat IP ganda (*duplicate IP conflict*).
3. **Konflik Timpaan Data (Lost Update):** Saat dua operator NOC mengedit berkas inventaris secara bersamaan, perubahan operator pertama seringkali tertimpa tanpa disadari oleh penyimpanan operator kedua.
4. **Dokumen Konfigurasi & Topologi Tersebar Bebas:** Berkas konfigurasi router (`.cfg`) dan diagram jaringan sering dibagikan melalui aplikasi pesan instan atau disimpan di komputer teknisi tanpa kontrol akses berizin dan enkripsi.
5. **Ketiadaan Jejak Audit (Audit Trail):** Ketika terjadi salah cabut port atau perubahan IP manajemen, tidak ada catatan digital mengenai siapa yang melakukan perubahan, kapan waktu perubahan, dan apa nilai data sebelum diubah.

### 1.2 Identifikasi Masalah
Berdasarkan latar belakang tersebut, masalah utama yang dirumuskan adalah:
1. Bagaimana merancang skema basis data relasional yang mampu menjamin integritas relasi fisik dan logis perangkat jaringan tanpa risiko relasi yatim (*orphan relationship*)?
2. Bagaimana mencegah timpaan data antar-operator NOC (*lost update*) pada saat pengeditan data secara bersamaan?
3. Bagaimana membangun sistem visualisasi graf topologi yang interaktif tanpa menampilkan status ketersediaan palsu (*fake telemetry*)?
4. Bagaimana memastikan sistem aman dari ancaman siber seperti *formula injection* (CWE-1236), *unauthorized downloads*, dan percobaan login berulang (*brute force*)?

### 1.3 Batasan Masalah
Ruang lingkup sistem NIMS pada Kerja Praktik ini dibatasi pada:
1. Pengelolaan data inventaris perangkat jaringan infrastruktur ISP (Router, Switch, OLT, Server, Firewall, Radio PtP, ONT).
2. Manajemen IPAM terbatas pada protokol IPv4 (kalkulasi bitwise CIDR, alokasi, dan pelepasan IP).
3. Pengelolaan dokumen lampiran teknis (maksimum 15 MB) dengan penyimpanan lokal privat (*private storage*).
4. Fokus pada inventarisasi administratif dan topologi statis; aplikasi tidak melakukan *live SNMP polling* atau eksekusi perintah otomatis ke perangkat produksi untuk menjaga stabilitas infrastruktur ISP.

### 1.4 Tujuan Kerja Praktik
1. Mengembangkan aplikasi web NIMS yang mengintegrasikan pencatatan perangkat, port antarmuka, IPAM, dan relasi kabel secara terpusat.
2. Menerapkan kontrol konkurensi data berbasis *Optimistic Locking* untuk menjamin konsistensi data.
3. Mengembangkan fitur impor massal CSV berstandar PRD §19.3 dengan validasi baris fisik dan eksekusi parsial.
4. Memenuhi seluruh 7 target Indikator Keberhasilan (KPI) yang ditetapkan pada PRD §2.3.

---

## BAB II: ANALISIS KEBUTUHAN & DESAIN SISTEM

### 2.1 Analisis Kebutuhan Fungsional (Prioritas P0 & P1)
Sistem dirancang berdasarkan *Product Requirement Document (PRD)* dengan pemisahan prioritas implementasi:
- **Modul Autentikasi & RBAC (P0):** Login aman, sesi cookie terenkripsi, proteksi multi-role (Admin, Network Engineer, Operator NOC, Supervisor, Auditor).
- **Modul Inventaris Perangkat (P0):** CRUD perangkat jaringan, penomoran unik kode aset, filter multi-dimensi, alur *soft-delete* (arsip dan restore).
- **Modul Port & Antarmuka (P0):** Pencatatan nama port, tipe, media transmisi, status administratif, dan *batch port generator*.
- **Modul IPAM Dasar (P0):** Kalkulasi prefix subnet, pencegahan alokasi IP pada alamat network/broadcast, serta alokasi dinamis IP manajemen.
- **Modul Relasi Jaringan (P0):** Aturan integritas relasi kabel ($A \neq B$, anti-duplikat simetris, dan aturan port fisik aktif tunggal).
- **Modul Ekspor & Audit Log (P0):** Ekspor CSV berstandar BOM UTF-8, sanitasi formula injection, dan peninjau perbedaan data (*diff viewer*).
- **Modul Topologi Relasi (P1):** Visualisasi kanvas React Flow, auto-layout kisi-kisi, dan penyimpanan koordinat layout per user.
- **Modul Impor CSV Massal (P1):** Template resmi PRD §19.3, validasi baris demi baris, pratinjau data valid vs gagal, dan eksekusi parsial.

### 2.2 Arsitektur Perangkat Lunak
NIMS mengadopsi arsitektur *Monolith Modern Berkinerja Tinggi* menggunakan **Next.js 16 App Router**:
1. **Server Components:** Merender halaman antarmuka di sisi server (SSR) untuk kecepatan muat awal dan keamanan maksimal (data kredensial dan koneksi database tidak pernah bocor ke browser client).
2. **Client Components:** Menangani interaktivitas dinamis seperti kanvas topologi React Flow, form validasi, dan drag-and-drop berkas.
3. **Route Handlers (API):** Melayani endpoint RESTful dengan proteksi ganda: validasi izin RBAC (`requireApiPermission`) dan sanitasi skema input via **Zod**.
4. **Data Access Layer:** Menggunakan **Prisma ORM** yang mengeksekusi *parameterized SQL queries* ke basis data PostgreSQL 18.

### 2.3 Desain Basis Data (ERD Final)
Basis data terdiri dari 17 entitas relasional utama yang dinormalisasi hingga bentuk normal ketiga (3NF):
- `User`, `Role`, `Permission`, `RolePermission`: Otentikasi dan otorisasi granular.
- `Site`, `Room`, `Rack`: Hirarki spasial penempatan perangkat.
- `Vendor`, `DeviceCategory`, `DeviceModel`: Taksonomi perangkat pabrikan.
- `Device`, `Interface`, `NetworkConnection`: Graf relasi jaringan dan inventaris fisik.
- `Subnet`, `IpAddress`: Manajemen alokasi IPAM.
- `Document`: Metadata berkas lampiran privat.
- `AuditLog`: Catatan transaksi immutable before-after.
- `TopologyLayout`: Penyimpanan posisi graf interaktif per pengguna.

### 2.4 Desain Keamanan Sistem (PRD §11.1)
1. **Pencegahan Lost Update (Optimistic Locking):** Kolom `version Int @default(1)` ditambahkan pada tabel `devices` dan `network_connections`. Setiap mutasi memeriksa apakah versi pada formulir cocok dengan versi basis data. Jika terjadi benturan, server mengembalikan status `HTTP 409 Conflict`.
2. **Pencegahan Formula Injection (CWE-1236):** Sanitasi otomatis pada seluruh string ekspor CSV yang diawali karakter formula (`=`, `+`, `-`, `@`, `\t`, `\r`) dengan menambahkan tanda petik tunggal (`'`).
3. **Rate Limiting Login:** Pembatasan maksimal 5 kali kegagalan login per 15 menit menggunakan algoritma *sliding window* (`src/lib/rate-limit.ts`). Percobaan ke-6 diblokir dengan respon `HTTP 429 Too Many Requests`.
4. **Penyimpanan Berkas Privat:** Berkas disimpan di luar direktori publik web (`storage/documents/`) dengan penamaan acak UUID, validasi ekstensi/MIME (menolak keras `.svg` dan `.html`), serta pengunduhan berizin dengan header `attachment` dan `nosniff`.

---

## BAB III: IMPLEMENTASI & HASIL PENGUJIAN

### 3.1 Tahapan Implementasi
Implementasi diselesaikan dalam 10 fase terstruktur:
- **Fase 0–2:** Fondasi proyek, migrasi skema PostgreSQL, sistem otentikasi `iron-session` & hashing `scrypt`, RBAC, dan CRUD inventaris perangkat dasar.
- **Fase 3:** Manajemen port antarmuka, batch generator port, dan IPAM dasar (kalkulasi bitwise CIDR & validasi host).
- **Fase 4:** Relasi konektivitas jaringan dengan penegakan 3 aturan integritas ($A \neq B$, anti-duplikat, dan single-cable constraint).
- **Fase 5:** Penyimpanan dokumen privat, verifikasi checksum SHA-256, dan pengunduhan berizin.
- **Fase 6:** Dashboard analitik data completeness, audit logs UI dengan visual diff, serta ekspor CSV anti-formula injection.
- **Fase 7:** Grafik visualisasi topologi React Flow (@xyflow/react), inspeksi interaktif node/edge, dan penyimpanan layout per user.
- **Fase 8:** Template impor CSV PRD §19.3, validasi baris fisik file, pratinjau error, dan eksekusi parsial.
- **Fase 9:** Pengujian keamanan menyeluruh, rate limiting, HTTP security headers, rehearsal backup-restore, pengujian beban skala besar, dan UAT fungsional.
- **Fase 10:** Penyusunan dokumentasi teknis, ERD final, buku panduan manual, dan materi presentasi sidang KP.

### 3.2 Hasil Pengujian Integrasi Otomatis
Seluruh fungsionalitas diuji menggunakan skrip otomasi pengujian integrasi (`npx tsx scripts/test-phase*.ts`):
- `test-phase3.ts`: 100% Lulus (Pembuatan port satuan, batch generator, kalkulasi CIDR, blokir network/broadcast IP, alokasi & pelepasan IP).
- `test-phase4.ts`: 100% Lulus (Validasi 3 aturan relasi jaringan, arsip koneksi, dan visibilitas simetris kedua sisi).
- `test-phase5.ts`: 100% Lulus (Penolakan URL statis berkas, penolakan format `.svg` & `.html`, verifikasi header `attachment` dan `nosniff`, audit trail unduhan).
- `test-phase6.ts`: 100% Lulus (Kesesuaian angka dashboard dengan query manual, filter audit log, penolakan unauthorized audit, dan proteksi formula injection CSV).
- `test-phase7.ts`: 100% Lulus (Kelengkapan data node & edge, filter relasi, ketiadaan label status up/down palsu, dan isolasi layout per user).
- `test-phase8.ts`: 100% Lulus (DoD T8.1: File 10 baris dengan 2 error menghasilkan tepat 8 tersimpan dan 2 dilaporkan lengkap dengan nomor baris fisik).
- `test-phase9.ts`: 100% Lulus (Rate limiting HTTP 429, CSRF origin rejection HTTP 403, security headers DENY/nosniff, backup rehearsal SHA-256, dan penolakan lost update HTTP 409).

### 3.3 Pengujian Kinerja Skala Besar (PRD §11.2 & T9.3)
Pengujian performa dilakukan dengan melakukan *stress seeding* data skala besar: **2.000 perangkat, 20.000 port antarmuka, dan 50.000 alamat IPAM**. Hasil pengukuran waktu respon sistem terhadap ambang batas PRD §11.2 adalah sebagai berikut:

| Parameter Pengujian | Target PRD §11.2 | Hasil Terukur | Status |
|---|:---:|:---:|:---:|
| **Pemuatan Daftar Perangkat (Limit 20, Pagination)** | $\le$ 3.000 ms | **105 ms** | **LULUS (28x lebih cepat)** |
| **Pencarian Perangkat Sederhana (`q=PERF-DEV-1500`)** | $\le$ 2.000 ms | **47 ms** | **LULUS (42x lebih cepat)** |
| **Penyaringan Kategori & Status (`ACTIVE`)** | $\le$ 2.000 ms | **22 ms** | **LULUS (90x lebih cepat)** |
| **Pencegahan Out-of-Memory (Memory Safety)** | Pagination aktif | **Tepat 50 item/page** | **LULUS** |

### 3.4 Pengujian Penerimaan Pengguna (UAT)
Pengujian UAT manual dijalankan bersama operator NOC dan pembimbing lapangan mencakup seluruh 26 skenario kebutuhan fungsional berkategori **P0 (Must-Have)** (dokumen lengkap pada `docs/UAT_SCENARIOS_P0.md`). Seluruh 26 skenario memperoleh status **PASS (100%)** tanpa adanya temuan cacat kritis.

---

## BAB IV: EVALUASI KPI PRD §2.3, PEMBAHASAN, & KESIMPULAN

### 4.1 Evaluasi Kuantitatif Indikator Keberhasilan (KPI PRD §2.3)

Evaluasi pencapaian sistem NIMS terhadap seluruh target KPI yang disepakati pada awal proyek:

| No | Indikator Keberhasilan (PRD §2.3) | Target Awal | Hasil Capaian Nyata | Status Evaluasi |
|---|---|:---:|:---:|:---:|
| 1 | **Kelengkapan data perangkat wajib** | $\ge$ 95% pada data migrasi | **100%** (20 dari 20 perangkat migrasi terisi seluruh kolom wajibnya) | **TERLAMPAUI** |
| 2 | **Keberhasilan pencarian perangkat** | $\ge$ 95% skenario uji | **100%** (Pencarian via kode, hostname, IP, dan serial number selalu tepat sasaran) | **TERLAMPAUI** |
| 3 | **Keberhasilan ekspor data** | 100% skenario ekspor | **100%** (Jumlah baris CSV cocok dengan filter, aman dari formula injection) | **TERCAPAI PENUH** |
| 4 | **Pencatatan perubahan data (Audit Trail)** | 100% mutasi penting | **100%** (Setiap aksi create, update, delete, archive, import, export tercatat lengkap) | **TERCAPAI PENUH** |
| 5 | **Integritas relasi jaringan** | Tidak ada relasi yatim | **100% Bersih** (Foreign key constraint & aturan $A \neq B$ mencegah orphan link) | **TERCAPAI PENUH** |
| 6 | **Penegakan hak akses (RBAC)** | Nol insiden kebocoran izin | **100% Terproteksi** (Operator tanpa hak ditolak HTTP 403 & tercatat di log) | **TERCAPAI PENUH** |
| 7 | **Kemudahan penggunaan operasional** | UAT diselesaikan mandiri | **100% Lulus UAT** (Operator menyelesaikan seluruh 26 tugas inti tanpa kendala) | **TERCAPAI PENUH** |

### 4.2 Analisis Dampak Operasional bagi ISP
Implementasi NIMS memberikan dampak positif terukur bagi efisiensi operasional tim NOC:
1. **Penurunan Waktu Identifikasi Masalah:** Waktu penelusuran port dan perangkat lawan yang sebelumnya membutuhkan waktu 10–20 menit mencari di spreadsheet berkurang menjadi **kurang dari 1 menit** melalui kanvas topologi dan pencarian terpusat.
2. **Eliminasi Konflik Lost Update:** Fitur *Optimistic Locking* menjamin tidak ada data konfigurasi atau inventaris yang tertimpa secara tidak sengaja saat pergantian shift (*handover*) operator.
3. **Standardisasi Alokasi IP (IPAM):** Menghilangkan insiden benturan alamat IP manajemen (*IP duplication*) berkat penegakan relasi unik dan pemblokiran otomatis pada alamat network/broadcast.

### 4.3 Kesimpulan
1. Sistem Inventaris Jaringan (NIMS) berhasil dirancang dan diimplementasikan secara penuh hingga Fase 10 sesuai spesifikasi PRD.
2. Seluruh fungsionalitas inti (CRUD inventaris, batch port generator, IPAM bitwise CIDR, relasi integritas kabel, topologi graf, dokumen privat, impor CSV parsial, dan ekspor anti-formula injection) bekerja dengan stabilitas tinggi.
3. Pengujian beban skala besar (2.000 perangkat, 20.000 port, dan 50.000 IP) membuktikan bahwa sistem memiliki latensi sangat rendah (105 ms) dan efisiensi memori yang unggul berkat arsitektur server-side pagination dan pengindeksan database yang optimal.
4. Seluruh 7 target KPI pada PRD §2.3 terbukti tercapai 100%.

### 4.4 Saran Pengembangan Lanjutan
Untuk pengembangan tahap berikutnya di luar lingkup MVP Kerja Praktik ini, disarankan:
1. **Integrasi Telemetri Read-Only (SNMP/Netconf Polling):** Menambahkan worker background asynchronous untuk memvalidasi nomor seri dan firmware perangkat secara periodik tanpa mengganggu performa web utama.
2. **Dukungan Multi-Tenant / VRF pada IPAM:** Memperluas skema IPAM agar mendukung tabel Virtual Routing and Forwarding (VRF) untuk jaringan pelanggan korporasi yang memiliki overlapping private IP space.
3. **Distributed Rate Limiting:** Memindahkan cache rate limiting in-memory ke cluster Redis jika aplikasi di-deploy multi-node di balik load balancer.
