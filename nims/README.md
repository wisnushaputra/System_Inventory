# NIMS Application (Next.js & Prisma)

Dokumentasi lengkap instalasi, arsitektur, panduan konfigurasi, dan pengujian NIMS tersedia pada [README Utama Repositori](../README.md).

## Quick Start
```bash
# Instal dependensi
npm install

# Setup basis data & seeding
npx prisma migrate dev
npx tsx prisma/seed.ts

# Jalankan server pengembangan
npm run dev

# Jalankan pengujian integrasi lengkap
npx tsx scripts/test-phase9.ts
```
Lihat dokumen lengkap pada folder [`../docs/`](../docs/).
