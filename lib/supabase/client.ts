import { createBrowserClient } from "@supabase/ssr";

// Dipakai di Client Component ('use client').
// Auth token dikelola otomatis oleh @supabase/ssr lewat cookie - TIDAK ADA
// lagi kolom SessionToken manual seperti di sheet Users versi Google Apps Script.
//
// Catatan: sengaja TIDAK memakai generic <Database> di sini. types/database.ts
// masih berupa tipe manual/placeholder yang belum lengkap dibanding skema
// sesungguhnya, dan supabase-js sangat ketat soal ini saat type-check produksi
// (npm run build) - bisa membuat semua hasil query jadi tipe 'never'. Setelah
// generate tipe otomatis lewat Supabase CLI (lihat catatan di types/database.ts),
// generic ini bisa diaktifkan lagi dengan aman.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
