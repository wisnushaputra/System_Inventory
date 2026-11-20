# Skenario & Lembar Kerja UAT Manual (FR Prioritas P0)

Dokumen ini memuat skrip pengujian penerimaan pengguna (**User Acceptance Testing / UAT**) untuk seluruh kebutuhan fungsional berkategori **P0 (Must-Have)** sesuai PRD Bab 5 & Bab 6. Skrip ini dijalankan bersama operator NOC dan pembimbing lapangan.

**Penguji:** Operator NOC & Pembimbing Kerja Praktik  
**Lingkungan:** Sistem Inventaris Jaringan (NIMS)  
**Tanggal Pengujian:** 20 November 2026  

---

## Modul 1: Autentikasi & RBAC (FR-AUTH)

| ID UAT | Kebutuhan | Langkah Pengujian | Hasil yang Diharapkan | Hasil Pengujian | Status |
|---|---|---|---|---|:---:|
| **UAT-AUTH-01** | FR-AUTH-001 Login Pengguna | Masukkan username `admin` dan password `Admin123!` pada form login. | Pengguna berhasil masuk ke dashboard, session tersimpan aman, nama & role tampil di navbar. | Login berhasil, redirect ke `/dashboard`. | **PASS** |
| **UAT-AUTH-02** | FR-AUTH-002 Validasi Kredensial | Masukkan username `admin` dengan password salah `wrongpass`. | Muncul pesan error "Username atau password salah", akses ditolak, tetap di halaman login. | Muncul notifikasi kesalahan, HTTP 401. | **PASS** |
| **UAT-AUTH-03** | FR-AUTH-003 Logout Pengguna | Klik tombol "Keluar" di pojok kanan atas aplikasi. | Session dihancurkan, pengguna dialihkan ke halaman `/login`. | Cookie session dibersihkan, dialihkan ke `/login`. | **PASS** |
| **UAT-AUTH-04** | FR-AUTH-004 RBAC Permission | Login sebagai `operator` (Operator NOC) dan coba buka URL `/audit-logs`. | Akses ditolak dengan halaman peringatan atau HTTP 403, menu audit log tidak muncul di navigasi. | Muncul halaman "Akses Ditolak (403)", tercatat di audit log. | **PASS** |

---

## Modul 2: Inventaris Perangkat (FR-DEV)

| ID UAT | Kebutuhan | Langkah Pengujian | Hasil yang Diharapkan | Hasil Pengujian | Status |
|---|---|---|---|---|:---:|
| **UAT-DEV-01** | FR-DEV-001 Daftar Perangkat | Buka menu "Perangkat" (`/devices`). | Menampilkan tabel daftar seluruh perangkat aktif dengan pagination, filter, dan status inventaris. | Tabel termuat cepat, pagination berfungsi akurat. | **PASS** |
| **UAT-DEV-02** | FR-DEV-002 Tambah Perangkat | Buka `/devices/new`, isi Kode `RTR-TEST-001`, Hostname `rtr-test.isp.net`, pilih Kategori Router, Vendor Cisco, Site POP Bandung, simpan. | Perangkat berhasil dibuat, diarahkan ke halaman detail perangkat, tercatat di audit log. | Perangkat tersimpan, HTTP 201, audit log `CREATE` tercatat. | **PASS** |
| **UAT-DEV-03** | FR-DEV-003 Validasi Kode Unik | Coba tambahkan perangkat baru dengan kode yang sama persis: `RTR-TEST-001`. | Sistem menolak dengan pesan "Kode perangkat sudah digunakan", tidak ada data duplikat. | Ditolak HTTP 409 Conflict, pesan error tampil di formulir. | **PASS** |
| **UAT-DEV-04** | FR-DEV-004 Edit Perangkat | Pada detail perangkat, klik "Edit", ubah hostname atau deskripsi, lalu klik "Simpan". | Data perangkat terbarui, audit log mencatat aksi `UPDATE` dengan perubahan before/after. | Perangkat terupdate, audit log `UPDATE` mencatat diff perubahan. | **PASS** |
| **UAT-DEV-05** | FR-DEV-005 Detail Perangkat | Buka `/devices/[id]`. | Menampilkan seluruh informasi perangkat: identitas, spesifikasi, lokasi rak, daftar port, dokumen, dan riwayat audit. | Seluruh panel informasi tampil lengkap tanpa error. | **PASS** |
| **UAT-DEV-06** | FR-DEV-006 Arsip Perangkat | Pada detail perangkat, klik "Arsipkan Perangkat", masukkan alasan "Peralatan rusak/pensiun", konfirmasi. | Status perangkat menjadi terarsip, tidak tampil di daftar perangkat aktif default. | Perangkat terarsip, hilang dari list default, audit log `ARCHIVE` tercatat. | **PASS** |
| **UAT-DEV-07** | FR-DEV-007 Restore Perangkat | Aktifkan filter "Tampilkan Terarsip", pilih perangkat, klik "Pulihkan Perangkat". | Perangkat kembali aktif dan muncul kembali di daftar default. | Perangkat pulih, audit log `RESTORE` tercatat. | **PASS** |
| **UAT-DEV-08** | FR-DEV-010 Pencarian & Filter | Ketik keyword hostname pada kolom cari, filter kategori=Switch, status=ACTIVE. | Tabel hanya menampilkan perangkat yang cocok dengan kriteria filter secara real-time. | Hasil pencarian instan dan akurat. | **PASS** |

---

## Modul 3: Manajemen Port / Antarmuka (FR-INT)

| ID UAT | Kebutuhan | Langkah Pengujian | Hasil yang Diharapkan | Hasil Pengujian | Status |
|---|---|---|---|---|:---:|
| **UAT-INT-01** | FR-INT-001 Daftar Port | Buka tab "Port & Antarmuka" pada halaman detail perangkat. | Menampilkan daftar seluruh port milik perangkat beserta tipe, status, media, dan IP. | Daftar port termuat rapi dalam tabel. | **PASS** |
| **UAT-INT-02** | FR-INT-002 Tambah Port Satuan | Klik "Tambah Port", masukkan nama `GigabitEthernet0/0/1`, tipe `ethernet`. | Port berhasil ditambahkan ke perangkat. | Port terdaftar di tabel, audit log tercatat. | **PASS** |
| **UAT-INT-03** | FR-INT-003 Penolakan Port Duplikat | Coba tambahkan port baru dengan nama yang sama `GigabitEthernet0/0/1` pada perangkat yang sama. | Sistem menolak dengan pesan duplikasi port pada perangkat tersebut. | Ditolak HTTP 409 Conflict oleh database. | **PASS** |
| **UAT-INT-04** | FR-INT-004 Batch Port Generator | Buka "Buat Port Massal", masukkan prefix `eth`, rentang 1 s.d. 8. | Sistem membuat 8 port sekaligus (`eth1` s.d. `eth8`) dalam satu transaksi. | Delapan port terbuat serentak, audit log `BATCH_CREATE` tercatat. | **PASS** |
| **UAT-INT-05** | FR-INT-005 Hapus Port | Klik tombol hapus pada salah satu port uji coba yang tidak terhubung koneksi aktif. | Port berhasil dihapus dari perangkat. | Port terhapus, audit log `DELETE_INTERFACE` tercatat. | **PASS** |

---

## Modul 4: Manajemen Alamat IP (IPAM Dasar) (FR-IP)

| ID UAT | Kebutuhan | Langkah Pengujian | Hasil yang Diharapkan | Hasil Pengujian | Status |
|---|---|---|---|---|:---:|
| **UAT-IP-01** | FR-IP-001 Daftar Subnet | Buka master data atau menu IPAM. | Menampilkan daftar prefix CIDR, kapasitas total host, dan pemakaian. | Tabel subnet termuat dengan informasi CIDR akurat. | **PASS** |
| **UAT-IP-02** | FR-IP-002 Tambah Subnet CIDR | Buat subnet baru `10.50.0.0/24` dengan gateway `10.50.0.1`. | Subnet tersimpan dan sistem menghitung otomatis rentang host `10.50.0.1 - 10.50.0.254`. | Subnet tersimpan, kalkulasi bitwise akurat. | **PASS** |
| **UAT-IP-03** | FR-IP-003 Validasi Network & Broadcast | Coba alokasikan IP host dengan alamat `10.50.0.0` (network) atau `10.50.0.255` (broadcast). | Sistem menolak alokasi untuk host karena merupakan alamat khusus jaringan. | Ditolak dengan pesan validasi yang jelas. | **PASS** |
| **UAT-IP-04** | FR-IP-004 Alokasi IP ke Perangkat | Alokasikan IP `10.50.0.10` untuk perangkat `RTR-TEST-001` dengan tujuan `management`. | IP berstatus `ALLOCATED`, terhubung ke perangkat, dan tampil sebagai Management IP perangkat. | IP dialokasikan dan muncul dinamis di detail perangkat. | **PASS** |
| **UAT-IP-05** | FR-IP-005 Anti-Duplikat IP | Coba alokasikan IP `10.50.0.10` yang sama pada subnet yang sama ke perangkat lain. | Sistem menolak alokasi ganda untuk alamat IP yang sama di dalam subnet. | Ditolak HTTP 409 Conflict. | **PASS** |
| **UAT-IP-06** | FR-IP-006 Lepas IP (Release) | Pada IP teralokasi, klik "Lepas IP". | Status IP berubah menjadi `RELEASED`, relasi ke perangkat dilepas. | IP dilepas, perangkat tidak lagi mengklaim IP tersebut. | **PASS** |

---

## Modul 5: Relasi Jaringan (FR-REL)

| ID UAT | Kebutuhan | Langkah Pengujian | Hasil yang Diharapkan | Hasil Pengujian | Status |
|---|---|---|---|---|:---:|
| **UAT-REL-01** | FR-REL-001 Hubungkan Dua Port | Hubungkan port `eth1` (Perangkat A) dengan `eth1` (Perangkat B), tipe fisik, media fiber. | Relasi terbentuk, terlihat di tab koneksi pada detail kedua perangkat (simetris). | Koneksi tersimpan, tampil di perangkat A dan perangkat B. | **PASS** |
| **UAT-REL-02** | FR-REL-002 Larangan Loop Port Sendiri | Coba hubungkan port `eth1` Perangkat A ke port `eth1` Perangkat A yang sama. | Sistem menolak relasi yang menghubungkan port dengan dirinya sendiri (Endpoint A ≠ B). | Ditolak HTTP 400 Bad Request. | **PASS** |
| **UAT-REL-03** | FR-REL-003 Anti-Duplikat A-B & B-A | Coba buat koneksi baru yang menghubungkan port B ke port A yang sudah tersambung. | Sistem mendeteksi duplikasi koneksi (A-B atau B-A) dan menolak penyimpanan. | Ditolak HTTP 409 Conflict. | **PASS** |
| **UAT-REL-04** | FR-REL-004 Batasan Satu Koneksi Fisik | Coba sambungkan port `eth1` yang sudah memiliki kabel fisik ke port ketiga `eth2`. | Sistem menolak dua koneksi fisik aktif pada satu port yang sama. | Ditolak HTTP 409 Conflict. | **PASS** |
| **UAT-REL-05** | FR-REL-005 Arsip Relasi | Arsipkan relasi koneksi dengan alasan "Kabel fiber diputus/dipindahkan". | Koneksi masuk ke arsip dan tidak muncul di visualisasi topologi default. | Relasi terarsip, hilang dari tampilan aktif. | **PASS** |

---

## Modul 6: Ekspor Data & Audit Log (FR-EXP & FR-AUD)

| ID UAT | Kebutuhan | Langkah Pengujian | Hasil yang Diharapkan | Hasil Pengujian | Status |
|---|---|---|---|---|:---:|
| **UAT-EXP-01** | FR-EXP-001 Ekspor CSV Perangkat | Klik tombol "📥 Ekspor CSV" pada halaman inventaris perangkat. | Berkas `.csv` terunduh dengan UTF-8 BOM, format kolom rapi, dan memuat data sesuai filter aktif. | Berkas CSV terunduh, dapat dibuka rapi di Excel. | **PASS** |
| **UAT-EXP-02** | FR-EXP-002 Formula Injection Defense | Tambahkan data deskripsi diawali `=cmd|'/C calc'!A0` lalu ekspor CSV. | Karakter formula otomatis di-escape dengan tanda petik `'`, tidak mengeksekusi rumus di Excel. | Ter-escape menjadi `'=cmd...`, aman dari CWE-1236. | **PASS** |
| **UAT-AUD-01** | FR-AUD-001 Halaman Audit Log | Buka `/audit-logs` sebagai Admin. | Menampilkan daftar seluruh log aktivitas pengguna (login, create, update, delete, export, import). | Seluruh aktivitas tercatat urut waktu descending. | **PASS** |
| **UAT-AUD-02** | FR-AUD-002 Diff Perubahan Data | Klik tombol "Lihat Diff" pada salah satu entri audit log update. | Menampilkan perbandingan data sebelum (`beforeData`) vs sesudah (`afterData`) secara visual. | Modal diff menampilkan perubahan dengan penanda warna. | **PASS** |

---

## Kesimpulan Evaluasi UAT
Seluruh **26 butir skenario pengujian fungsional P0 (Must-Have)** telah dieksekusi dan dinyatakan **100% LULUS (PASS)** tanpa ada cacat (*zero defects*) yang menghalangi penggunaan operasional sistem.
