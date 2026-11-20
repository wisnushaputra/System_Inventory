# NIMS — Network Inventory Management System

**NIMS (Network Inventory Management System)** adalah aplikasi web manajemen inventaris dan topologi perangkat jaringan berbasis enterprise yang dirancang khusus untuk operasional **Network Operation Center (NOC) Internet Service Provider (ISP)**.

Sistem ini menggantikan pencatatan spreadsheet manual yang terfragmentasi dengan repositori terpusat yang menerapkan validasi integritas relasi jaringan, manajemen alamat IP (IPAM), topologi interaktif, proteksi konkurensi data (*optimistic locking*), audit trail lengkap, dan kontrol akses berbasis peran (*Role-Based Access Control / RBAC*).

---

## 🚀 Fitur Utama

- **Inventaris Perangkat Jaringan**: Pencatatan lengkap router, switch, OLT, firewall, server, radio, dan ONT dengan filter dinamis, penomoran aset unik, status inventaris (`ACTIVE`, `PLANNED`, `MAINTENANCE`, `RETIRED`, `LOST`), dan penanganan arsip tanpa penghapusan fisik (*soft delete*).
- **Pencegahan Lost Update (Optimistic Locking)**: Mencegah timpaan data antar-operator saat mengedit perangkat atau relasi secara bersamaan melalui nomor versi (`version Int @default(1)`).
- **Manajemen Port & Batch Generator**: Pencatatan port antarmuka perangkat (tipe, status, media transmisi) serta generator pembuatan port massal instan (misal `eth1` s.d. `eth24`).
- **IP Address Management (IPAM) Dasar**: Perhitungan bitwise IPv4 CIDR, identifikasi otomatis alamat network dan broadcast (menolak alokasi host pada network/broadcast), alokasi IP dinamis ke perangkat, serta alur lepas/release IP.
- **Relasi Jaringan Berintegritas Tinggi**: Validasi koneksi fisik dan logis antarperangkat dengan 3 aturan integritas inti:
  1. Port sumber tidak boleh sama dengan port tujuan ($A \neq B$).
  2. Anti-duplikasi simetris ($A \leftrightarrow B$ sama dengan $B \leftrightarrow A$).
  3. Pembatasan fisik: satu port fisik aktif hanya boleh terhubung ke tepat satu kabel fisik.
- **Visualisasi Topologi Kanvas Interaktif (@xyflow/react)**: Grafik visual hubungan antarperangkat dengan fitur inspeksi detail node & edge, filter site/kategori, auto-layout rapi, dan penyimpanan tata letak (*layout*) mandiri terisolasi per pengguna.
- **Penyimpanan Dokumen Privat Berizin**: Penyimpanan berkas lampiran (diagram topologi, backup config, bukti serah terima) di disk privat dengan nama acak UUID, verifikasi checksum SHA-256, whitelist MIME/ekstensi (menolak keras `.svg` dan `.html`), serta pengunduhan berizin dengan header `attachment` dan `nosniff`.
- **Dashboard Analitik & Audit Kelengkapan Data**: Kartu ringkasan statistik real-time, visualisasi distribusi per kategori/status/site, serta pendeteksi otomatis perangkat yang belum lengkap (tanpa IP manajemen, serial number, atau model).
- **Audit Log Trail & Diff Viewer**: Pencatatan kronologis seluruh mutasi sistem (`CREATE`, `UPDATE`, `DELETE`, `ARCHIVE`, `RESTORE`, `LOGIN`, `IMPORT`, `EXPORT`, `ACCESS_DENIED`) lengkap dengan peninjau perbedaan data (*before vs after diff*).
- **Impor CSV Parsial Berstandar PRD §19.3**: Template CSV resmi, validasi baris demi baris, pratinjau data valid vs gagal, serta eksekusi impor parsial (baris valid tersimpan, baris gagal dilaporkan dengan nomor baris fisik).
- **Ekspor CSV Aman (Anti-Formula Injection)**: Ekspor inventaris dan audit log dengan UTF-8 BOM, serta sanitasi otomatis karakter formula (`=`, `+`, `-`, `@`, `\t`, `\r`) untuk mencegah serangan spreadsheet CWE-1236.
- **Keamanan Enterprise (§11.1)**: Hashing password dengan `scrypt`, rate limiting percobaan login (maks 5x per 15 menit), validasi CSRF & origin, dan HTTP security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).

---

## 🛠️ Stack Teknologi

| Komponen                  | Teknologi                                 | Keterangan                                 |
| ------------------------- | ----------------------------------------- | ------------------------------------------ |
| **Framework**       | Next.js 16 (App Router)                   | Server Components & Route Handlers         |
| **Bahasa**          | TypeScript 5                              | Strict type-safety end-to-end              |
| **Styling**         | Tailwind CSS v4                           | Antarmuka responsif dan modern             |
| **Basis Data**      | PostgreSQL 18 (Local)                     | Database relasional ACID                   |
| **ORM**             | Prisma ORM 6.19                           | Migrasi skema & parameterized queries      |
| **Autentikasi**     | `iron-session` + `node:crypto.scrypt` | Cookie terenkripsi HttpOnly & SameSite=Lax |
| **Validasi**        | Zod                                       | Validasi skema di boundary sistem          |
| **Grafik Topologi** | `@xyflow/react`                         | Kanvas graf visual topologi interaktif     |

---

## 📋 Prasyarat Sistem

1. **Node.js**: Versi `>= 20.x` (LTS disarankan).
2. **npm**: Versi `>= 10.x`.
3. **PostgreSQL**: Versi `>= 16.x` berjalan lokal pada port `5432`.

---

## ⚙️ Panduan Instalasi & Menjalankan

### 1. Kloning Repositori & Masuk ke Direktori

```bash
git clone https://github.com/username/System_Inventory.git
cd System_Inventory/nims
```

### 2. Instalasi Dependensi

```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)

Salin berkas contoh atau buat berkas `.env` pada direktori `nims/`:

```env
# Koneksi Database PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nims?schema=public"

# Kunci Enkripsi Sesi (Minimal 32 karakter acak)
SESSION_SECRET="nims_super_secret_session_key_minimum_32_characters_long_12345"

# Konfigurasi Server
PORT=3000
NODE_ENV=production
```

### 4. Migrasi Basis Data & Seeding Data Awal

Jalankan migrasi skema database dan masukkan data master awal (roles, permissions, default users, vendors, categories, sites, rooms, racks):

```bash
npx prisma migrate dev
npx tsx prisma/seed.ts
```

### 5. Menjalankan Aplikasi

#### Mode Pengembangan (Development):

```bash
npm run dev
```

Akses aplikasi melalui peramban web di: `http://localhost:3000`.

#### Mode Produksi (Production Build & Start):

```bash
npm run build
npm start
```

---

## 🔑 Kredensial Pengguna Awal (Seeder)

Setelah menjalankan `prisma/seed.ts`, akun-akun berikut siap digunakan:

| Username     | Password         | Role                   | Hak Akses Utama                                                                        |
| ------------ | ---------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| `admin`    | `Admin123!`    | **Admin**        | Akses penuh seluruh modul (CRUD, Audit, Master, Ekspor, Impor, Dokumen)                |
| `operator` | `Operator123!` | **Operator NOC** | Hak baca/tulis terbatas perangkat & relasi (tidak dapat melihat audit log atau ekspor) |

---

## 🧪 Pengujian Otomatis (Automated Testing)

Aplikasi dilengkapi dengan rangkaian skrip pengujian integrasi per fase yang dapat dijalankan langsung:

```bash
# Pengujian Port & IPAM Dasar (Fase 3)
npx tsx scripts/test-phase3.ts

# Pengujian Integritas Relasi Jaringan (Fase 4)
npx tsx scripts/test-phase4.ts

# Pengujian Dokumen & Private Storage (Fase 5)
npx tsx scripts/test-phase5.ts

# Pengujian Dashboard, Audit Logs, & Ekspor CSV (Fase 6)
npx tsx scripts/test-phase6.ts

# Pengujian Topologi Kanvas & Layout User (Fase 7)
npx tsx scripts/test-phase7.ts

# Pengujian Impor CSV & Parsial Execution (Fase 8)
npx tsx scripts/test-phase8.ts

# Pengujian Hardening, Rate Limiting, & Optimistic Locking (Fase 9)
npx tsx scripts/test-phase9.ts

# Pengujian Tolok Ukur Skala Besar (2.000 Perangkat, 20.000 Port, 50.000 IP)
npx tsx scripts/benchmark-performance.ts

# Pengujian Rehearsal Backup & Restore Data
npx tsx scripts/rehearsal-backup-restore.ts

# Pengujian Migrasi Data Asli ISP & Rekonsiliasi
npx tsx scripts/test-migration.ts
```

---

## 📁 Struktur Direktori Proyek

```text
System_Inventory/
├── docs/                                 # Dokumentasi Teknis & Sidang KP
│   ├── ERD_AND_PERMISSIONS.md            # Diagram ERD & Matriks RBAC
│   ├── USER_MANUAL.md                    # Buku Manual Pengguna Aplikasi
│   ├── LAPORAN_KP.md                     # Laporan Kerja Praktik Lengkap
│   ├── SLIDE_DEMO_SIDANG.md              # Slide Presentasi Demo Sidang KP
│   ├── SECURITY_CHECKLIST_11_1.md        # Verifikasi Kebutuhan Keamanan §11.1
│   ├── UAT_SCENARIOS_P0.md               # Lembar Kerja UAT 26 Skenario P0
│   └── MIGRATION_RECONCILIATION_REPORT.md# Laporan Rekonsiliasi Data Migrasi
├── nims/                                 # Sumber Kode Aplikasi Next.js
│   ├── data/                             # Dataset Uji & Berkas Migrasi CSV
│   ├── prisma/                           # Skema Prisma, Migrasi, & Seeder
│   │   ├── migrations/                   # Riwayat Migrasi Skema PostgreSQL
│   │   ├── schema.prisma                 # Skema Basis Data Relasional
│   │   └── seed.ts                       # Skrip Seeder Master Data & Akun
│   ├── scripts/                          # Skrip Pengujian Integrasi Otomatis
│   ├── src/
│   │   ├── app/                          # Next.js App Router (Halaman & API Handlers)
│   │   │   ├── (protected)/              # Halaman Terproteksi Session & RBAC
│   │   │   │   ├── audit-logs/           # UI Audit Logs & Diff Viewer
│   │   │   │   ├── dashboard/            # UI Dashboard & Data Completeness
│   │   │   │   ├── devices/              # UI Inventaris Perangkat & Impor CSV
│   │   │   │   ├── master/               # UI Master Data
│   │   │   │   └── topology/             # UI Topologi Kanvas (@xyflow/react)
│   │   │   ├── api/                      # RESTful Route Handlers
│   │   │   │   ├── audit-logs/           # Endpoint Audit Log
│   │   │   │   ├── auth/                 # Login & Logout Handlers
│   │   │   │   ├── connections/          # Endpoint Relasi Jaringan
│   │   │   │   ├── devices/              # Endpoint Perangkat & Port
│   │   │   │   ├── documents/            # Endpoint Dokumen & Unduhan Privat
│   │   │   │   ├── export/               # Endpoint Ekspor CSV Aman
│   │   │   │   ├── import/               # Endpoint Impor CSV PRD §19.3
│   │   │   │   ├── ipam/                 # Endpoint Subnet & Alokasi IP
│   │   │   │   └── topology/             # Endpoint Data Topologi & Layout
│   │   │   └── login/                    # Halaman Login
│   │   ├── lib/                          # Library Utility & Helper
│   │   │   ├── audit.ts                  # Helper Audit Logging
│   │   │   ├── auth.ts                   # Helper Validasi Permission & RBAC
│   │   │   ├── device-import.ts          # Parser & Validasi CSV Impor
│   │   │   ├── ipam.ts                   # Utilitas Kalkulasi Bitwise CIDR
│   │   │   ├── password.ts               # Hashing Password scrypt
│   │   │   ├── prisma.ts                 # Prisma Client Singleton
│   │   │   ├── rate-limit.ts             # In-memory Rate Limiter
│   │   │   └── session.ts                # Session Management (iron-session)
│   │   └── storage/                      # Direktori Penyimpanan Berkas Privat
│   └── next.config.ts                    # Konfigurasi Next.js & Security Headers
├── PRD_Network_Inventory_Management_System.md # Dokumen Spesifikasi PRD Resmi
├── TASKS.md                              # Roadmap & Milestone Pelaksanaan KP
└── README.md                             # Dokumentasi Utama Repositori
```

---

## 📜 Lisensi & Hak Cipta

Dikembangkan untuk keperluan Kerja Praktik (KP) Teknik Informatika / Sistem Informasi.
Hak Cipta © 2026.
