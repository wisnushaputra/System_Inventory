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
- [ ] **T0.2 Setup repo & environment** — Next.js + TypeScript + Tailwind + Prisma, PostgreSQL, `.env`, `.gitignore`.
      DoD: `npm run dev` jalan + `npx prisma migrate dev` sukses di mesin sendiri, commit pertama.
      Status: skeleton Next.js 16.4.6 + React 19.3.0 + TypeScript + Tailwind 4.3.3 sudah ada di `nims/`.
      Belum: `npm install` (gagal `EALLOWSCRIPTS` di npm 11.17), `node_modules`, `.env`, `prisma/`, PostgreSQL.
- [ ] **T0.3 Skeleton auth** — pakai `iron-session` + `scrypt` (`node:crypto`), jangan tulis dari nol.
      DoD: login, logout, halaman terproteksi jalan.
- [ ] **T0.4 Seeder role & permission** — 4 role PRD §4.5 + daftar permission (`device.view`, dst).
      DoD: `prisma migrate reset` + `npm run db:seed` menghasilkan 4 role + N permission tanpa error.

## Fase 1 — Data Master & RBAC (Minggu 2)

- [ ] **T1.1 Migration urutan FK**: sites → rooms → racks → vendors → device_categories →
      device_models → users/roles/permissions/role_permissions (D1: satu role per user, tanpa `role_user`).
      DoD: `prisma migrate reset` sukses, `prisma migrate deploy` di DB kosong sukses.
- [ ] **T1.2 Penegakan permission di backend** — middleware/policy, bukan sembunyikan tombol.
      DoD: tes otomatis: user tanpa `device.create` → 403.
- [ ] **T1.3 CRUD master data** — vendor, kategori, model, site (+ ruang/rak bila dipakai).
      DoD: tidak bisa hapus vendor/site yang masih dipakai perangkat.
- [ ] **T1.4 Fondasi audit log** — tabel `audit_logs` + observer/base model.
      DoD: create/update/delete satu record menghasilkan 1 baris log dengan before/after.
      (Dibangun sekarang supaya modul berikutnya otomatis tercatat.)

## Fase 2 — Perangkat (Minggu 3–4)

- [ ] **T2.1 Tabel `devices`** sesuai PRD §9.3 + unique `device_code` + index pencarian.
      DoD: constraint unik terbukti menolak duplikat di level DB.
- [ ] **T2.2 Daftar perangkat** — tabel, pagination, filter, sorting (§8.3).
      DoD: 100 baris data contoh tetap responsif; pagination tidak ambil semua data.
- [ ] **T2.3 Pencarian** hostname/device code/IP/serial/model (§FR-DEV-009).
      DoD: tes: cari hostname, serial, dan IP menemukan perangkat yang benar.
- [ ] **T2.4 Form tambah/edit** + validasi FormRequest + pesan error per field.
      DoD: AC §6.1 lolos semua (7 poin).
- [ ] **T2.5 Halaman detail** dengan tab Overview/Network/Ports/Connections/Documents/History
      (tab boleh kosong dulu, diisi fase berikutnya).
- [ ] **T2.6 Arsip perangkat** dengan alasan + filter arsip.
      DoD: AC §6.5 lolos; perangkat terarsip hilang dari daftar default, histori tetap ada.

## Fase 3 — Port & IPAM (Minggu 5–6)

- [ ] **T3.1 Tabel `interfaces`** + unique `(device_id, name)`.
      DoD: dua port nama sama di satu perangkat ditolak.
- [ ] **T3.2 CRUD port di detail perangkat** (+ opsional "tambah N port berpola nama").
- [ ] **T3.3 Tabel `subnets` & `ip_addresses`** + constraint keunikan sesuai keputusan VRF (T0.1).
      DoD: alokasi IP ganda di ruang alamat sama ditolak oleh DB, bukan cuma validasi form.
- [ ] **T3.4 Alur alokasi/lepas IP** — status AVAILABLE/ALLOCATED/RELEASED, validasi CIDR
      pakai library, bukan regex.
      DoD: IP network/broadcast ditolak untuk host; IP valid tersimpan.
- [ ] **T3.5 Management IP perangkat** diambil dari `ip_addresses` (purpose=management),
      tidak ada kolom duplikat di `devices`.

## Fase 4 — Relasi Jaringan (Minggu 7)

- [ ] **T4.1 Skema relasi** `network_connections` (+ `connection_endpoints` bila dipakai)
      dengan: endpoint A ≠ B, anti-duplikat A-B/B-A, satu port satu koneksi fisik aktif.
      DoD: tiga aturan di atas terbukti ditolak oleh DB/tes.
- [ ] **T4.2 Form tambah/edit relasi** + pilih dua port (autocomplete perangkat→port).
      DoD: AC §6.3 lolos.
- [ ] **T4.3 Tampilan koneksi di detail perangkat** (port ini ↔ perangkat/port lawan) + filter.
- [ ] **T4.4 Arsip relasi** + aturan: relasi perangkat terarsip tidak muncul di tampilan default.

## Fase 5 — Dokumen (Minggu 8)

- [ ] **T5.1 Upload & metadata** — private storage, nama file acak, checksum, ukuran maksimum.
      DoD: file tidak bisa diakses lewat URL langsung.
- [ ] **T5.2 Validasi unggahan** — whitelist MIME/ekstensi, tolak `.svg`/`.html`,
      sajikan unduhan dengan `Content-Disposition: attachment` + `nosniff`.
- [ ] **T5.3 Akses berizin** — endpoint unduh cek permission; list dokumen di detail perangkat.
      DoD: user tanpa izin → 403, tercatat di audit.

## Fase 6 — Dashboard, Audit UI, Ekspor (Minggu 9)

- [ ] **T6.1 Dashboard** — kartu total perangkat/site/subnet/relasi, per kategori, per status,
      daftar data belum lengkap. DoD: angka cocok dengan hasil query manual.
- [ ] **T6.2 Halaman audit log** — filter user/objek/aksi/tanggal, read-only.
- [ ] **T6.3 Ekspor CSV/XLSX sesuai filter + RBAC.**
      DoD: AC §6.6 lolos; sel diawali `= + - @` di-escape; aktivitas ekspor tercatat.

## Fase 7 — Topologi (Minggu 10, P1 — kerjakan hanya jika Fase 0–6 hijau)

- [ ] **T7.1 Grafik relasi** (React Flow) dari data tersimpan, filter site/kategori/tipe relasi.
      DoD: klik node → detail; klik edge → dua port; ada legenda; tidak ada label up/down.
- [ ] **T7.2 Simpan layout** per user (opsional).

## Fase 8 — Impor (Minggu 10–11, P1)

- [ ] **T8.1 Template CSV perangkat** + validasi kolom/tipe + preview + laporan error per baris.
      DoD: file 10 baris dengan 2 error → 8 tersimpan, 2 dilaporkan dengan nomor baris.
- [ ] **T8.2 Catat hasil impor** — user, waktu, jumlah sukses/gagal.

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
