# TASKS — NIMS (Network Inventory Management System)

Sumber requirement: `PRD_Network_Inventory_Management_System.md`
Estimasi: 12 minggu kerja + buffer. Centang per task, jangan lompat fase.

Aturan umum sebelum mulai tiap task:
1. Baca FR terkait di PRD (§5) dan aturan bisnis (§10).
2. Buat migration → model → route → UI → tes → commit. Satu task satu commit.
3. **Selesai** = bisa didemokan, validasi ada di backend, dan tes/cek manual lolos.
4. Jangan buat UI sebelum migration-nya jalan (`prisma migrate reset` + seed bersih).
5. Perbarui checklist ini setiap selesai task: `[x]` hanya jika DoD terpenuhi; `⏳` untuk bagian yang menunggu pihak luar (pembimbing/perusahaan).

---

## Fase 0 — Keputusan & Fondasi (Minggu 1)

- [x] **T0.1 Tulis `DECISIONS.md`** — kunci keputusan sebelum migration. ⏳ menunggu tanda tangan pembimbing untuk perubahan stack PRD §12.1.
      Isi: role (D1), Management IP (D2), VRF (D3), arsip vs status (D4), auth (D5),
      topologi canvas (D6), batas fitur (D7), aturan integritas DB (D8).
      DoD: D1–D8 tertulis dengan alasan + persetujuan pembimbing.
- [x] **T0.2 Setup repo & environment** — Next.js + TypeScript + Tailwind + Prisma, PostgreSQL, `.env`, `.gitignore`.
      DoD: `npm run dev` jalan + `npx prisma migrate dev` sukses di mesin sendiri, commit pertama (`f944701`).
      Status: Skeleton Next.js 16 + React 19 + TypeScript + Tailwind 4 di `nims/`. Database PostgreSQL `nims` aktif di `localhost:5432`, migration `20261118224448_init` berhasil di-apply.
- [x] **T0.3 Skeleton auth** — pakai `iron-session` + `scrypt` (`node:crypto`), jangan tulis dari nol.
      DoD: login, logout, halaman terproteksi jalan.
      Status: `/login`, `/api/auth/login`, `/api/auth/logout`, proteksi `(protected)/layout.tsx` & `/dashboard` teruji lolos validasi origin, cookie session terenkripsi, dan redirect unauthenticated.
- [x] **T0.4 Seeder role & permission** — 4 role PRD §4.5 + daftar permission (`device.view`, dst).
      DoD: `prisma migrate reset` / migrate + `npm run db:seed` menghasilkan 4 role + N permission tanpa error.
      Status: `npm run db:seed` berhasil mengeksekusi seeder: 4 role, 21 permission, 1 user admin terisi di PostgreSQL.

## Fase 1 — Data Master & RBAC (Minggu 2)

- [x] **T1.1 Migration urutan FK**: sites → rooms → racks → vendors → device_categories →
      device_models → users/roles/permissions/role_permissions (D1: satu role per user, tanpa `role_user`).
      DoD: `prisma migrate reset` sukses, `prisma migrate deploy` di DB kosong sukses.
      Status: Model `Site`, `Room`, `Rack`, `Vendor`, `DeviceCategory`, `DeviceModel`, dan `AuditLog` telah ditambahkan di `schema.prisma`. Migrasi `20261118230741_add_master_data_and_audit` berhasil diaplikasikan dan diuji reset bersih.
- [x] **T1.2 Penegakan permission di backend** — middleware/policy, bukan sembunyikan tombol.
      DoD: tes otomatis: user tanpa izin terkait → 403.
      Status: Helper `requireApiPermission` dan `requirePermission` aktif. Uji otomatis `scripts/test-phase1.ts` memverifikasi operator NOC tanpa izin `site.manage` ditolak dengan HTTP 403.
- [x] **T1.3 CRUD master data** — vendor, kategori, model, site (+ ruang/rak).
      DoD: tidak bisa hapus vendor/site yang masih dipakai perangkat/model.
      Status: Endpoint API CRUD lengkap di `/api/master/**` + UI di `/master`. Uji otomatis memverifikasi penghapusan vendor yang memiliki model terdaftar ditolak dengan HTTP 409.
- [x] **T1.4 Fondasi audit log** — tabel `audit_logs` + helper `logAudit`.
      DoD: create/update/delete satu record menghasilkan 1 baris log dengan before/after.
      Status: `src/lib/audit.ts` terintegrasi pada auth dan seluruh mutasi master data dengan sanitasi data sensitif. Uji otomatis membuktikan pencatatan CREATE/DELETE lengkap dengan `beforeData`/`afterData`.

## Fase 2 — Perangkat (Minggu 3–4)

- [x] **T2.1 Tabel `devices`** sesuai PRD §9.3 + unique `device_code` + index pencarian.
      DoD: constraint unik terbukti menolak duplikat di level DB.
      Status: Model `Device` terpasang dengan indeks pencarian pada hostname, serial, site, kategori, status, dan arsip. Migrasi `20261119161851_add_device_model` sukses diaplikasikan; penolakan duplikat kode terbukti menghasilkan error P2002 di level DB.
- [x] **T2.2 Daftar perangkat** — tabel, pagination, filter, sorting (§8.3).
      DoD: 100 baris data contoh tetap responsif; pagination tidak ambil semua data.
      Status: 100 baris data contoh ter-seed; responsivitas pagination 29ms (<3000ms PRD target); query pagination hanya mengambil data potongan limit (10 baris per halaman).
- [x] **T2.3 Pencarian** hostname/device code/IP/serial/model (§FR-DEV-009).
      DoD: tes: cari hostname, serial, dan model menemukan perangkat yang benar.
      Status: Uji otomatis membuktikan query pencarian multi-kriteria `q` berhasil menemukan perangkat secara tepat berdasarkan hostname, serial number, maupun nama model.
- [x] **T2.4 Form tambah/edit** + validasi FormRequest/Zod + pesan error per field.
      DoD: AC §6.1 lolos semua (7 poin).
      Status: Endpoint `POST /api/devices` & `PUT /api/devices/[id]` dengan validasi Zod field-level. Form submit kosong menampilkan pesan kesalahan spesifik per-field, penolakan kode duplikat (409), dan proteksi izin `device.create` (403 untuk non-engineer).
- [x] **T2.5 Halaman detail** dengan tab Overview/Network/Ports/Connections/Documents/History.
      Status: Halaman detail di `/devices/[id]` dengan 6 tab terstruktur. Tab Overview menampilkan metadata lengkap, tab Network/Ports/Connections/Documents siap untuk Fase 3-5, dan tab History langsung membaca riwayat audit log spesifik perangkat dari tabel `audit_logs`.
- [x] **T2.6 Arsip perangkat** dengan alasan + filter arsip.
      DoD: AC §6.5 lolos; perangkat terarsip hilang dari daftar default, histori tetap ada.
      Status: Endpoint `/api/devices/[id]/archive` mewajibkan pengisian alasan arsip. Perangkat terarsip terbukti tidak muncul pada query aktif default (`isArchived=false`), muncul pada filter arsip (`isArchived=true`), dapat dipulihkan via restore, dan tercatat di audit log.

## Fase 3 — Port & IPAM (Minggu 5–6)

- [x] **T3.1 Tabel `interfaces`** + unique `(device_id, name)`.
      DoD: dua port nama sama di satu perangkat ditolak.
      Status: Model `Interface` dan tabel migrasi `20261119175137_add_ports_and_ipam` berhasil dibuat dengan constraint `UNIQUE("deviceId", "name")`. Terbukti via pengujian integrasi otomatis menolak pembuatan dua port bernama sama pada satu perangkat (HTTP 409 & Prisma P2002).
- [x] **T3.2 CRUD port di detail perangkat** (+ opsional "tambah N port berpola nama").
      Status: Endpoint `/api/devices/[id]/interfaces` dan `[interfaceId]` mendukung pembuatan single port, penghapusan port, serta pembuatan port batch berpola (`mode: 'batch'`, contoh `ether1`..`ether4`). UI Tab 3 (Ports) di `/devices/[id]` menampilkan daftar port, status, IP binding, dan modal penambahan port batch.
- [x] **T3.3 Tabel `subnets` & `ip_addresses`** + constraint keunikan sesuai keputusan VRF (T0.1 / D3).
      DoD: alokasi IP ganda di ruang alamat sama ditolak oleh DB, bukan cuma validasi form.
      Status: Model `Subnet` dan `IpAddress` terpasang dengan constraint `UNIQUE("subnetId", "address")`. Terbukti penolakan alokasi IP ganda pada subnet yang sama menghasilkan HTTP 409 dan penolakan di tingkat basis data.
- [x] **T3.4 Alur alokasi/lepas IP** — status AVAILABLE/ALLOCATED/RELEASED, validasi CIDR pakai library/bitwise kalkulator, bukan regex.
      DoD: IP network/broadcast ditolak untuk host; IP valid tersimpan.
      Status: Library `src/lib/ipam.ts` mengkalkulasi network/broadcast bitwise secara presisi. Uji integrasi membuktikan `10.99.0.0` (network) dan `10.99.0.255` (broadcast) ditolak dengan pesan spesifik; IP valid `10.99.0.1` tersimpan; alur release via `POST /api/ipam/addresses/[id]/release` mengubah status menjadi `RELEASED`, mengisi `releasedAt`, dan membersihkan binding perangkat/interface.
- [x] **T3.5 Management IP perangkat** diambil dari `ip_addresses` (purpose=management), tidak ada kolom duplikat di `devices`.
      Status: Sesuai Keputusan D2, kolom `devices` tidak memuat kolom `management_ip`. Query list (`GET /api/devices`) dan detail (`GET /api/devices/[id]`) secara dinamis meng-query relasi `ipAddresses` (`purpose='management'`, `allocationStatus='ALLOCATED'`) dan menyajikannya sebagai `managementIp`, yang ditampilkan pada tabel daftar perangkat dan Tab 2 (Network).

## Fase 4 — Relasi Jaringan (Minggu 7)

- [x] **T4.1 Skema relasi** `network_connections` (+ `connection_endpoints` bila dipakai) dengan: endpoint A ≠ B, anti-duplikat A-B/B-A, satu port satu koneksi fisik aktif.
      DoD: tiga aturan di atas terbukti ditolak oleh DB/tes.
      Status: Model `NetworkConnection` dan migrasi `20261120140738_add_network_connections` berhasil dibuat. Terbukti via tes integrasi: (1) Endpoint A = B ditolak HTTP 400 & CHECK constraint, (2) Duplikasi koneksi A-B dan B-A ditolak oleh level DB constraint unik `UNIQUE("endpointAInterfaceId", "endpointBInterfaceId")` dengan canonical ordering (HTTP 409), (3) Penolakan koneksi fisik aktif ganda pada satu port (HTTP 409).
- [x] **T4.2 Form tambah/edit relasi** + pilih dua port (autocomplete perangkat→port).
      DoD: AC §6.3 lolos.
      Status: Endpoint `/api/connections` dan `/api/devices/interfaces-lookup` terpasang. Form modal di Tab 4 (Connections) mendukung pemilihan port lokal, pemilihan perangkat lawan, pemilihan port lawan, pemilihan tipe relasi, media transmisi, kapasitas link, serta pencatatan audit log `CREATE_CONNECTION`.
- [x] **T4.3 Tampilan koneksi di detail perangkat** (port ini ↔ perangkat/port lawan) + filter.
      Status: Tab 4 (Connections) pada `/devices/[id]` menampilkan daftar relasi aktif yang menghubungkan port lokal ke perangkat dan port lawan beserta tautan navigasi, media, kapasitas, dan label. Muncul konsisten di kedua sisi perangkat yang terhubung.
- [x] **T4.4 Arsip relasi** + aturan: relasi perangkat terarsip tidak muncul di tampilan default.
      Status: Endpoint `/api/connections/[id]/archive` mewajibkan pengisian alasan arsip. Relasi terarsip terbukti tidak muncul pada tampilan default (`isArchived=false`), muncul jika filter arsip diaktifkan (`isArchived=true`), dapat dipulihkan via restore `/api/connections/[id]/restore`, dan relasi pada perangkat yang sedang diarsipkan otomatis disaring keluar dari tampilan default.

## Fase 5 — Dokumen (Minggu 8)

- [x] **T5.1 Upload & metadata** — private storage, nama file acak, checksum, ukuran maksimum.
      DoD: file tidak bisa diakses lewat URL langsung.
      Status: Model `Document` & migrasi `20261120143214_add_documents` dibuat. Berkas fisik disimpan di direktori privat `nims/storage/documents/` (di luar `public/`), nama berkas acak UUID v4 (`<uuid>.<ext>`), checksum SHA-256 dihitung secara akurat, batas ukuran 15 MB ditegakkan. Upaya akses URL langsung (`/storage/documents/<key>` atau `/storage/<key>`) terbukti mengembalikan HTTP 404 (DoD lolos).
- [x] **T5.2 Validasi unggahan** — whitelist MIME/ekstensi, tolak `.svg`/`.html`,
      sajikan unduhan dengan `Content-Disposition: attachment` + `nosniff`.
      Status: Whitelist format & MIME (PDF, PNG, JPG, WEBP, TXT, LOG, CFG, CSV, XLSX, DOCX, ZIP) ditegakkan. Upaya upload berkas berbahaya `.svg` dan `.html` terbukti ditolak HTTP 400. Berkas yang diunduh via `/api/documents/[id]/download` menyertakan header `Content-Disposition: attachment; filename="<original>"` dan `X-Content-Type-Options: nosniff`.
- [x] **T5.3 Akses berizin** — endpoint unduh cek permission; list dokumen di detail perangkat.
      DoD: user tanpa izin → 403, tercatat di audit.
      Status: Endpoint unduh cek izin `document.view`; endpoint unggah cek `document.upload`. Percobaan unggah dokumen oleh Operator NOC (tidak memiliki `document.upload`) terbukti menghasilkan HTTP 403 dan insiden penolakan dicatat di `audit_logs` (`action='ACCESS_DENIED'`). Aktivitas pengunggahan dicatat sebagai `UPLOAD_DOCUMENT` dan pengunduhan dicatat sebagai `DOWNLOAD_DOCUMENT`. Tab 5 pada detail perangkat menampilkan tabel dokumen lampiran lengkap dengan aksi unduh dan hapus berizin.

## Fase 6 — Dashboard, Audit UI, Ekspor (Minggu 9)

- [x] **T6.1 Dashboard** — kartu total perangkat/site/subnet/relasi, per kategori, per status,
      daftar data belum lengkap. DoD: angka cocok dengan hasil query manual.
      Status: Endpoint `/api/dashboard/stats` dan UI `/dashboard` (`DashboardClient.tsx`) selesai. Menampilkan kartu total perangkat aktif vs terarsip, total site, total subnet IPAM, dan total koneksi aktif. Menyajikan visual breakdown per kategori, per status inventaris, dan per site. Dilengkapi audit kelengkapan data (*data completeness*) yang mendeteksi perangkat tanpa Management IP, tanpa Serial Number, tanpa Model, atau tanpa Rak/Ruang beserta tautan cepat untuk melengkapinya. Terbukti via tes integrasi: angka statistik kartu cocok 100% dengan hasil query database manual (DoD lolos).
- [x] **T6.2 Halaman audit log** — filter user/objek/aksi/tanggal, read-only.
      Status: Endpoint `/api/audit-logs` dan antarmuka read-only `/audit-logs` (`AuditLogClient.tsx`) selesai. Mendukung filter pengguna, tipe entitas, aksi, dan rentang tanggal dengan pagination serta peninjau *diff* (`beforeData` vs `afterData`). RBAC ditegakkan dengan izin `audit.view`: Operator NOC yang mencoba mengakses terbukti ditolak HTTP 403 dan insiden dicatat di audit log (`action='ACCESS_DENIED'`) (DoD lolos). Menu navigasi atas hanya muncul bagi pengguna berwenang.
- [x] **T6.3 Ekspor CSV/XLSX sesuai filter + RBAC.**
      DoD: AC §6.6 lolos; sel diawali `= + - @` di-escape; aktivitas ekspor tercatat.
      Status: Endpoint `/api/export/devices` dan `/api/export/audit-logs` selesai beserta tombol ekspor di UI inventaris dan audit log. RBAC ditegakkan via izin `report.export`: Operator NOC terbukti ditolak HTTP 403. Proteksi Formula Injection (CWE-1236) terbukti aktif: sel yang diawali karakter formula (`=`, `+`, `-`, `@`, `\t`, `\r`) otomatis di-*escape* dengan tanda kutip tunggal (`'`). Berkas diekspor dengan UTF-8 Byte Order Mark (BOM: `0xEF, 0xBB, 0xBF`) untuk kompatibilitas spreadsheet. Setiap aktivitas ekspor terbukti tercatat di `audit_logs` dengan `action='EXPORT'` memuat filter dan jumlah baris (DoD lolos).

## Fase 7 — Topologi (Minggu 10, P1 — kerjakan hanya jika Fase 0–6 hijau)

- [x] **T7.1 Grafik relasi** (React Flow) dari data tersimpan, filter site/kategori/tipe relasi.
      DoD: klik node → detail; klik edge → dua port; ada legenda; tidak ada label up/down.
      Status: Terimplementasi menggunakan `@xyflow/react` pada `/topology` dan `/api/topology`. Terbukti via tes integrasi: (1) Klik node menampilkan detail lengkap perangkat (hostname, code, vendor/model, IP management, site, status inventaris, link navigasi detail), (2) Klik edge menampilkan detail kedua port terhubung (Endpoint A port & hostname ↔ Endpoint B port & hostname, media, kapasitas, dan tipe relasi), (3) Legenda topologi membedakan koneksi fisik vs logis serta media transmisi, (4) Terbukti 100% TIDAK ADA label status up/down/online/offline real-time pada kanvas (hanya status administratif inventaris ACTIVE/PLANNED/MAINTENANCE per PRD §5.2 & §6.4), (5) Filter site, kategori perangkat, dan tipe relasi berfungsi akurat (DoD lolos).
- [x] **T7.2 Simpan layout** per user (opsional).
      Status: Model `TopologyLayout` dan migrasi `20261120151405_add_topology_layouts` dibuat. Endpoint `/api/topology/layout` (GET & POST) mendukung penyimpanan posisi koordinat node per user dan per scope (default / per site). Terbukti via tes integrasi: posisi node tersimpan persisten di DB dan terisolasi mandiri antar user (Admin vs Operator NOC). Pengguna juga dapat menekan tombol "Rapikan Posisi" untuk kalkulasi auto-layout grid otomatis (DoD lolos).

## Fase 8 — Impor (Minggu 10–11, P1)

- [x] **T8.1 Template CSV perangkat** + validasi kolom/tipe + preview + laporan error per baris.
      DoD: file 10 baris dengan 2 error → 8 tersimpan, 2 dilaporkan dengan nomor baris.
      Status: Endpoint `/api/import/devices/template`, `/api/import/devices/preview`, dan `/api/import/devices/execute` selesai beserta antarmuka `/devices/import` (`DeviceImportClient.tsx`). Template CSV disajikan berstandar PRD §19.3 lengkap dengan UTF-8 BOM dan header nosniff. Validasi kolom, relasi kategori, vendor, site, dan alokasi management IP dilakukan secara ketat. Terbukti via tes integrasi `scripts/test-phase8.ts`: berkas 10 baris dengan 2 error menghasilkan tepat 8 perangkat tersimpan di basis data dan 2 baris error ditolak serta dilaporkan lengkap dengan nomor baris fisik berkas CSV (DoD lolos).
- [x] **T8.2 Catat hasil impor** — user, waktu, jumlah sukses/gagal.
      Status: Tipe audit log diperluas dengan aksi `IMPORT`. Setiap eksekusi impor terbukti tercatat di `audit_logs` memuat ID pengguna yang mengeksekusi, timestamp, `successCount=8`, `failedCount=2`, `totalCount=10`, serta rincian kesalahan per baris. RBAC ditegakkan via izin `device.create`: Operator NOC tanpa izin terbukti ditolak HTTP 403 dan insiden dicatat di audit log (`action='ACCESS_DENIED'`) (DoD lolos).

## Fase 9 — Hardening & UAT (Minggu 11–12)

- [ ] **T9.1 Uji keamanan** — rate limit login, CSRF, header, backup/restore rehearsal.
      DoD: daftar checklist §11.1 dicentang dengan bukti (bukan asumsi).
- [ ] **T9.2 Optimistic locking** pada edit perangkat/relasi (cegah lost update).
- [ ] **T9.3 Data uji performa** — 2.000 perangkat / 20.000 port / 50.000 IP; ukur §11.2.
- [ ] **T9.4 Skrip UAT manual** per FR P0, dijalankan bersama operator/pembimbing, bug dicatat.
- [ ] **T9.5 Migrasi data asli** dari spreadsheet (pakai impor) + rekonsiliasi jumlah baris.

## Fase 10 — Dokumentasi & Sidang (paralel, final Minggu 12)

- [ ] **T10.1 README** — instalasi, konfigurasi `.env`, seeding, cara menjalankan.
- [ ] **T10.2 ERD final + daftar permission** (dokumen, bukan gambar tangan).
- [ ] **T10.3 Buku manual pengguna** — alur tambah perangkat, relasi, ekspor.
- [ ] **T10.4 Laporan KP + slide demo** dengan struktur: masalah → desain → demo → evaluasi KPI §2.3.

---

## Urutan potong kalau waktu mepet
1. Fase 7 (topologi canvas)
2. Fase 8 preview impor (sisakan impor dasar tanpa preview)
3. rooms/racks
4. filter audit log
5. VLAN (§5.8)
6. reset password via email (pakai reset oleh admin)

Jangan potong: RBAC, audit log, arsip + histori, validasi unik, unduhan file berizin.