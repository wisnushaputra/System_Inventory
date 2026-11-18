# DECISIONS — NIMS

Keputusan yang dikunci sebelum migration pertama. Ubah hanya lewat persetujuan pembimbing + catat alasannya di sini.
Status: **menunggu persetujuan pembimbing** (tanggal: ____).

## D1 — RBAC: satu role per user + permission per role
- `users.role_id` (FK tunggal) + `roles` + `permissions` + `role_permissions`.
- Tidak ada multi-role; matriks PRD §4.5 sel "Sesuai izin/Terbatas/Opsional" diganti daftar permission eksplisit per role.
- Alasan: 4 role tetap, admin yang mengelola; multi-role tidak dibutuhkan dan menambah UI + query.
- Upgrade bila perlu: tambah pivot `role_user` (perubahan terisolasi).

## D2 — Management IP hanya di `ip_addresses`
- Tidak ada kolom `management_ip` di `devices`. IP diambil dari `ip_addresses` dengan `purpose='management'`.
- Alasan: satu sumber kebenaran; menghindari dua nilai berbeda untuk hal yang sama.
- Dampak: daftar & detail perangkat memakai subquery/join, bukan kolom.

## D3 — VRF tidak dipakai di MVP
- Tidak ada tabel `vrfs`, tidak ada kolom `vrf_name`. Keunikan IP: `unique(subnet_id, address)`.
- Alasan: VRF string bebas tidak bisa ditegakkan (case, typo, NULL di PostgreSQL); tidak sepadan untuk KP.
- Batasan MVP yang harus ditulis di laporan: dua jaringan terisolasi dengan IP sama dianggap duplikat.
- Upgrade: tabel `vrfs` + `unique(vrf_id, address)`.

## D4 — Arsip (`archived_at`) ≠ status inventaris
- `inventory_status` = siklus hidup (PLANNED/ACTIVE/MAINTENANCE/RETIRED/LOST), tetap tampil di daftar.
- `archived_at` = menyembunyikan dari tampilan kerja (daftar default, dashboard, relasi default). Bisa dicari lewat filter "Diarsipkan".
- Arsip boleh untuk status apa pun, wajib alasan + konfirmasi; UI memperingatkan bila status masih ACTIVE.
- Alasan: memblokir arsip membuat orang memakai jalan pintas (rename/delete); PRD hanya mewajibkan alasan + konfirmasi.
- Relasi milik perangkat terarsip tidak tampil di tampilan default, data tetap utuh.

## D5 — Next.js (App Router) + React + TypeScript, auth session cookie
- Stack: Next.js App Router, React, TypeScript, Tailwind, Prisma, Zod. UI dan route handler dalam satu codebase.
- Autentikasi: session cookie terenkripsi (`iron-session`) + hash password `scrypt` dari `node:crypto`. Tidak ada JWT, OAuth, atau email.
- Otorisasi: guard membaca ulang user dari DB setiap request (cek `is_active` + permission); role di cookie tidak dipercaya.
- Alasan: satu bahasa, satu proses, satu deployment; PHP/Composer tidak diperlukan (Node 26 sudah terpasang).
- Dampak: UI di `app/**`, API di `app/api/**/route.ts` (PRD §13 tetap berlaku), mutasi lewat route handler + verifikasi Origin.

## D6 — Topologi: daftar relasi P0, kanvas P1
- P0: daftar koneksi di detail perangkat + tampilan "neighbor" satu level + relasi per site.
- P1 (hanya bila Fase 0–6 hijau): kanvas React Flow, filter, simpan layout.
- Alasan: kanvas = item termahal, bukan syarat "satu sumber data"; risiko timeline KP.

## D7 — Batas fitur MVP
- PDF: tidak ada. Ekspor CSV/XLSX saja.
- Impor: template CSV (P1), tanpa preview per-baris bila waktu mepet.
- rooms/racks: P1, boleh dipotong.
- Reset password: oleh admin, tanpa email/SMTP.

## D8 — Aturan data yang wajib di DB (bukan hanya di form)
- `devices.device_code` unik; `interfaces (device_id, name)` unik.
- `ip_addresses (subnet_id, address)` unik; pelepasan IP = ubah status, baris tidak dihapus (histori di audit log).
- Satu port = satu koneksi fisik aktif, ditegakkan di tabel `connection_endpoints` + partial unique index.
- Relasi A-B dan B-A dianggap sama: unique index pada `(LEAST(a,b), GREATEST(a,b))`.

## Lingkungan
- Node.js 20+ (terpasang: 26) + npm 11, PostgreSQL 16+, Git. PHP/Composer tidak dipakai.
- Aplikasi Next.js di `nims/`; dokumen (PRD, TASKS, DECISIONS) di root repo.
- Timezone `Asia/Jakarta`, locale `id`, DB `nims`.
- Dua index yang tidak bisa dideklarasikan di `schema.prisma` ditambahkan lewat migration SQL manual (lihat D8).
