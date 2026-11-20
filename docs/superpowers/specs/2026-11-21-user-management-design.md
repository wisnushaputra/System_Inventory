# Desain Teknis: Modul Manajemen Pengguna (User Management) NIMS

## 1. Latar Belakang & Tujuan
Menyediakan modul administrasi pengguna (*User Management*) bagi role **Admin** di halaman `/users` untuk mengelola akun operator jaringan, engineer, dan supervisor secara mandiri dengan perlindungan RBAC, validasi kredensial, dan pencatatan audit trail menyeluruh.

---

## 2. Arsitektur Backend API

### 2.1 Endpoint yang Dibutuhkan
Semua endpoint dilindungi oleh izin `user.manage` dan pemeriksaan CSRF Origin untuk mutasi:

1. `GET /api/users`:
   - Query params: `q` (pencarian nama/username/email), `roleId`, `isActive`, `page`, `limit`.
   - Mengembalikan daftar pengguna dengan relasi role (`role.name`), tanpa menyertakan kolom sensitif `passwordHash`.
2. `POST /api/users`:
   - Body: `{ name, username, email?, password, roleId, isActive? }`.
   - Validasi: username unik minimal 3 karakter alfanumerik, password minimal 8 karakter, roleId valid.
   - Meng-hash password menggunakan `hashPassword` (scrypt).
   - Mencatat AuditLog: `action: 'CREATE'`, `entityType: 'User'`.
3. `PUT /api/users/[id]`:
   - Body: `{ name, email?, roleId, isActive }`.
   - Proteksi diri sendiri: Admin tidak dapat menonaktifkan akunnya sendiri (`isActive = false` ditolak jika `id === currentUser.id`).
   - Mencatat AuditLog: `action: 'UPDATE'`, `entityType: 'User'`.
4. `POST /api/users/[id]/reset-password`:
   - Body: `{ newPassword }`.
   - Validasi: password baru minimal 8 karakter.
   - Meng-hash password baru dan mencatat AuditLog: `action: 'UPDATE'`, `entityType: 'User'`.
5. `DELETE /api/users/[id]`:
   - Proteksi diri sendiri: Admin tidak dapat menghapus akunnya sendiri (`id === currentUser.id` ditolak).
   - Menghapus pengguna (atau menonaktifkan akun jika ada relasi dokumen/audit yang terkunci).
   - Mencatat AuditLog: `action: 'DELETE'`, `entityType: 'User'`.
6. `GET /api/roles`:
   - Mengembalikan daftar role (`Admin`, `Network Engineer`, `Operator NOC`, `Supervisor`) untuk pilihan dropdown form.

---

## 3. Desain Antarmuka Pengguna (`/users`)

### 3.1 Navigasi Header (`layout.tsx`)
- Tautan menu baru **"Pengguna"** disematkan di navbar atas, hanya dirender jika `hasPermission(user, 'user.manage')` bernilai `true`.

### 3.2 Halaman `/users` & Komponen `UserListClient.tsx`
- **Header Halaman**: Judul "Manajemen Pengguna", deskripsi ringkas, dan tombol *"+ Tambah Pengguna"*.
- **Bilah Pencarian & Filter**:
  - Kolom input pencarian (nama, username, email).
  - Filter Role (Semua Role, Admin, Network Engineer, Operator NOC, Supervisor).
  - Filter Status Akun (Semua Status, Aktif, Nonaktif).
- **Tabel Pengguna**:
  - Kolom: Nama Lengkap, Username, Email, Role (Badge ungu untuk Admin, biru untuk Engineer, hijau untuk NOC, dll), Status (Badge hijau Aktif vs abu-abu Nonaktif), Terakhir Login, Aksi.
  - Kolom Aksi per Baris: Tombol *Edit*, Tombol *Reset Password*, Tombol *Hapus*.
- **Modal Interaktif**:
  1. *Modal Tambah Pengguna*: Input nama, username, email, pilihan role, password awal & konfirmasi password, status aktif.
  2. *Modal Edit Pengguna*: Input nama, email, pilihan role, dan toggle status aktif.
  3. *Modal Reset Password*: Input password baru dan konfirmasi kata sandi.
  4. *Modal Konfirmasi Hapus*: Peringatan penghapusan dengan tombol konfirmasi bahaya.

---

## 4. Kriteria Keberhasilan (DoD)
1. Role Admin dapat membuka `/users` dan mengelola pengguna secara penuh (Create, Read, Update, Reset Password, Delete).
2. Role tanpa izin `user.manage` (seperti Operator NOC) ditolak dengan HTTP 403 baik di halaman maupun di seluruh API `/api/users`.
3. Admin tidak dapat menonaktifkan atau menghapus akun miliknya sendiri.
4. Kata sandi di-hash menggunakan algoritma `scrypt` dan tidak pernah dibocorkan pada respon API apa pun.
5. Setiap tindakan perubahan pengguna tercatat rapi pada Audit Log.
6. Seluruh skrip uji otomatis (`test-users.ts`) dan uji regresi lolos 100%.
