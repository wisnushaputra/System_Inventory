# Checklist Keamanan Sistem (PRD §11.1)

Dokumen ini memverifikasi pemenuhan seluruh kriteria kebutuhan non-fungsional keamanan sesuai spesifikasi **PRD §11.1** dan kriteria **Definition of Done (DoD) T9.1**.

| No | Kriteria Keamanan (§11.1) | Status | Bukti Implementasi & Verifikasi |
|---|---|:---:|---|
| 1 | **HTTPS pada lingkungan produksi** | [x] | Reverse proxy Nginx/Caddy atau Cloudflare SSL terminates HTTPS. `Strict-Transport-Security` diaktifkan di production. |
| 2 | **Penyimpanan Password Aman** | [x] | Password di-hash menggunakan `node:crypto.scrypt` dengan 16-byte random salt unik per akun, tidak pernah disimpan plaintext (`src/lib/password.ts`). Terverifikasi via `test-auth.ts`. |
| 3 | **Penegakan RBAC & Validasi Permission** | [x] | Setiap endpoint API memanggil `requireApiPermission(permission, req)` dan komponen server memanggil `requirePermission(permission)`. Upaya unauthorized ditolak HTTP 403 & dicatat di audit log (`action='ACCESS_DENIED'`). Terverifikasi di `test-phase2.ts`, `test-phase5.ts`, `test-phase6.ts`, `test-phase8.ts`. |
| 4 | **Pencegahan SQL Injection** | [x] | Seluruh query ke PostgreSQL menggunakan Prisma ORM dengan parameterized queries. Tidak ada string concatenation atau raw query yang tidak tervalidasi. |
| 5 | **Proteksi CSRF (Cross-Site Request Forgery)** | [x] | Validasi header `Origin` terhadap `host` pada seluruh mutasi HTTP POST/PUT/DELETE. Session menggunakan cookie HttpOnly, SameSite=Lax (`iron-session`). Terverifikasi di `test-phase9.ts` (origin ilegal ditolak HTTP 403). |
| 6 | **Validasi & Sanitasi Input (Anti-XSS & CWE-1236)** | [x] | Seluruh input divalidasi dengan skema Zod di boundary sistem. Ekspor CSV menerapkan sanitasi formula injection (`sanitizeCsvCell`, escape `= + - @`). Render antarmuka menggunakan React JSX yang otomatis melakukan auto-escape. |
| 7 | **Rate Limiting Login** | [x] | Rate limiter in-memory sliding window (`src/lib/rate-limit.ts`) membatasi maksimal 5 percobaan login gagal per 15 menit. Percobaan ke-6 ditolak `HTTP 429 Too Many Requests` disertai header `Retry-After`. Terverifikasi di `test-phase9.ts`. |
| 8 | **Manajemen Rahasia (Secret Management)** | [x] | Kunci enkripsi cookie (`SESSION_SECRET`) dan koneksi basis data (`DATABASE_URL`) disimpan di `.env` / environment variable, tidak pernah di-hardcode ke repositori git. |
| 9 | **Penyimpanan Berkas Privat (Private Storage)** | [x] | Berkas lampiran disimpan di direktori privat non-publik (`storage/documents/`) dengan UUID acak. URL berkas statis langsung ditolak HTTP 404. Unduhan harus melalui endpoint berizin `/api/documents/[id]/download`. Terverifikasi di `test-phase5.ts`. |
| 10 | **Validasi Ekstensi & MIME Berkas** | [x] | Whitelist MIME type & ekstensi berkas. Format berbahaya seperti `.svg` dan `.html` ditolak mentah-mentah (HTTP 400). Unduhan disajikan dengan `Content-Disposition: attachment` dan `X-Content-Type-Options: nosniff`. Terverifikasi di `test-phase5.ts`. |
| 11 | **Sanitasi Data Sensitif pada Audit Log** | [x] | Fungsi `sanitizeData` di `src/lib/audit.ts` menyamarkan (`[REDACTED]`) field password, passwordHash, token, dan secret sebelum dicatat ke tabel `audit_logs`. |
| 12 | **Prinsip Least Privilege Database** | [x] | Akun koneksi aplikasi memiliki hak terbatas pada skema basis data `public` NIMS tanpa izin superuser. |
| 13 | **Mekanisme Backup & Uji Pemulihan Data (Rehearsal)** | [x] | Skrip backup otomatis dan verifikasi checksum SHA-256 (`scripts/rehearsal-backup-restore.ts`). Simulasi restore membuktikan integritas relasi dan zero data loss. Terverifikasi di `test-phase9.ts`. |
| 14 | **HTTP Security Headers** | [x] | Header proteksi `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `Permissions-Policy` diterapkan pada seluruh rute melalui `next.config.ts`. Terverifikasi di `test-phase9.ts`. |
