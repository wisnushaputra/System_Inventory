# User Management Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun modul Manajemen Pengguna menyeluruh bagi role Admin di halaman `/users` dan endpoint `/api/users` lengkap dengan CRUD pengguna, reset password, proteksi akun sendiri, RBAC guard, dan audit logging.

**Architecture:** Menggunakan Next.js 16 App Router, Prisma ORM, validasi Zod, scrypt hashing via `hashPassword`, dan proteksi API melalui `requireApiPermission('user.manage')`. Pada sisi antarmuka, `UserListClient.tsx` menyajikan tabel pengguna dengan filter reaktif dan modal interaktif (Tambah, Edit, Reset Password, Hapus).

**Tech Stack:** Next.js 16.4.6, React 19, Prisma ORM, PostgreSQL, Zod, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-11-21-user-management-design.md`

## Global Constraints
- Izin `user.manage` diwajibkan untuk semua operasi backend dan frontend pengguna.
- Kolom sensitif `passwordHash` tidak boleh diekspos pada respon API (harus disanitasi).
- Mutasi data mewajibkan verifikasi Origin CSRF header.
- Bebas dari karakter em dash pada teks antarmuka (Aturan Antislop R-02).
- Admin tidak dapat menonaktifkan atau menghapus akunnya sendiri.

## Review Focus
1. User tanpa izin `user.manage` (Operator NOC) ditolak HTTP 403 pada semua endpoint pengguna.
2. Pendaftaran user baru dengan username kembar ditolak dengan HTTP 409.
3. Password di-hash dengan benar dan dapat digunakan untuk login di `/api/auth/login`.
4. Admin tidak dapat menonaktifkan akun miliknya sendiri saat ini.
5. Reset password berfungsi dan mencatat aktivitas di Audit Log.

---

### Task 1: Bangun Backend API Manajemen Pengguna & Role
**Files:**
- Create: `nims/src/app/api/roles/route.ts`
- Create: `nims/src/app/api/users/route.ts`
- Create: `nims/src/app/api/users/[id]/route.ts`
- Create: `nims/src/app/api/users/[id]/reset-password/route.ts`

**Steps:**
- [ ] 1.1 Buat endpoint `GET /api/roles` untuk mengambil daftar role yang tersedia.
- [ ] 1.2 Buat endpoint `GET /api/users` (daftar user berpaginasi, search, filter) dan `POST /api/users` (buat user baru, hash password, catat audit log).
- [ ] 1.3 Buat endpoint `GET /api/users/[id]`, `PUT /api/users/[id]` (update data user & status aktif dengan self-protection), dan `DELETE /api/users/[id]` (hapus user dengan self-protection).
- [ ] 1.4 Buat endpoint `POST /api/users/[id]/reset-password` untuk mereset kata sandi staf.

---

### Task 2: Implementasi Antarmuka Manajemen Pengguna (`/users`)
**Files:**
- Modify: `nims/src/app/(protected)/layout.tsx`
- Create: `nims/src/app/(protected)/users/page.tsx`
- Create: `nims/src/app/(protected)/users/UserListClient.tsx`

**Steps:**
- [ ] 2.1 Perbarui `layout.tsx` untuk menampilkan menu navigasi "Pengguna" jika user memiliki izin `user.manage`.
- [ ] 2.2 Buat halaman Server Component `page.tsx` di `(protected)/users/` dengan guard `requirePermission('user.manage')`.
- [ ] 2.3 Buat komponen antarmuka `UserListClient.tsx` lengkap dengan tabel, badge role/status, filter bar, modal Tambah, modal Edit, modal Reset Password, dan modal Hapus.

---

### Task 3: Uji Coba TDD, Regresi, dan Verifikasi Build
**Files:**
- Create: `nims/scripts/test-users.ts`

**Steps:**
- [ ] 3.1 Buat skrip uji komprehensif `nims/scripts/test-users.ts` untuk memvalidasi seluruh alur CRUD, reset password, login user baru, proteksi akun sendiri, dan RBAC rejection.
- [ ] 3.2 Jalankan `test-users.ts` dan pastikan lolos 100%.
- [ ] 3.3 Jalankan seluruh regresi sistem (`test-phase6.ts`, `test-phase7.ts`, `test-hierarchy.ts`, `test-topology-drilldown.ts`).
- [ ] 3.4 Jalankan `npm run build` dan nyalakan ulang server daemon.
- [ ] 3.5 Catat perubahan ke dokumentasi dan lakukan git commit.
