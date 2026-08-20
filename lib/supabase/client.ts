import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Dipakai di Client Component ('use client').
// Auth token dikelola otomatis oleh @supabase/ssr lewat cookie - TIDAK ADA
// lagi kolom SessionToken manual seperti di sheet Users versi Google Apps Script.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
