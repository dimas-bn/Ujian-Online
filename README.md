# Ujian Online (ujiand.web.id) - Migrasi ke Next.js + Supabase

Scaffold awal hasil migrasi dari Google Apps Script (`code.gs` + `index.html`).

## Yang sudah ada di scaffold ini

- Struktur folder App Router lengkap (lihat isi `app/`)
- Koneksi Supabase (client browser & server) di `lib/supabase/`
- Middleware role-guard dasar (`middleware.ts`)
- Halaman login dengan mapping UserID -> email sintetis untuk Supabase Auth
- Alur ujian siswa (`app/exam/[examId]/page.tsx`) dengan **autosave dan submit
  yang sudah diperbaiki** dari 2 bug kritis yang ditemukan di audit `index.html` lama:
  - Autosave (`syncNow`) benar-benar mengirim ke server tiap 3 detik, bukan
    fungsi yang memanggil dirinya sendiri tanpa efek seperti `debouncedSync()` lama.
  - Submit (`handleSubmit`) SELALU mengecek `result.success` dari server dan
    punya penanganan error jaringan dengan opsi "Coba lagi" - bukan langsung
    menampilkan "Ujian Selesai!" tanpa verifikasi seperti `executeSubmission()` lama.
- API routes untuk: validasi PIN, ambil soal (tanpa kunci jawaban), sync
  jawaban (upsert atomik), submit + auto-grading (PG/PG_KOMPLEKS/BS/JODOH),
  dan log pelanggaran anti-cheat.
- `schema.sql` (dari langkah sebelumnya) dengan RLS supaya siswa hanya bisa
  akses baris jawabannya sendiri.

## Yang BELUM dibuat di scaffold ini (langkah lanjutan)

- Halaman admin selengkapnya (exams, questions, users, monitor, images, config)
  - masih placeholder, ikuti pola yang sama seperti halaman lain
- Komponen render tiap tipe soal (PG_KOMPLEKS, BS, JODOH, Esai) di halaman ujian
  - baru PG yang lengkap, lainnya perlu component terpisah di `components/exam/`
- Anti-cheat (fullscreen lock, deteksi blur/visibility) - logic-nya bisa
  di-porting cukup langsung dari `enableAntiCheat`/`handleSecurityTrigger` di
  `index.html` lama, tinggal panggil endpoint `/api/violations` yang sudah ada
- Generate PDF (kartu ujian, rekap nilai) - sarankan pakai `@react-pdf/renderer`
- Import soal dari Excel (SheetJS sudah ada di package.json, tinggal dipakai)
- Seed data awal (admin default, dst) - karena datamu masih data contoh,
  tidak perlu script migrasi, cukup buat lewat Supabase dashboard atau seed SQL sendiri

## Cara menjalankan

1. Buat project baru di [supabase.com](https://supabase.com), lalu jalankan
   isi `schema.sql` di **SQL Editor** project tersebut.
2. Salin `.env.local.example` jadi `.env.local`, isi dengan URL & key dari
   **Project Settings > API** di dashboard Supabase.
3. Install dependency:
   ```bash
   npm install
   ```
4. Jalankan mode development:
   ```bash
   npm run dev
   ```
5. Buka `http://localhost:3000`

## Deploy ke Vercel

1. Push folder ini ke repo GitHub baru
2. Import repo tersebut di [vercel.com/new](https://vercel.com/new)
3. Isi environment variables yang sama seperti `.env.local` di pengaturan project Vercel
4. Deploy - setiap `git push` berikutnya otomatis re-deploy
5. Tambahkan domain `ujiand.web.id` di **Settings > Domains**
