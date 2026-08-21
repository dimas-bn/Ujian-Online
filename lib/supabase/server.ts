import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Dipakai di Server Component / Route Handler (app/api/**/route.ts).
// Client ini otomatis membaca sesi dari cookie request yang masuk, sehingga
// setiap query ke Postgres berjalan "sebagai" user yang login -> RLS policy
// di schema.sql (siswa hanya boleh akses responses miliknya sendiri) berlaku
// otomatis di level database, tanpa perlu dicek manual di tiap fungsi seperti
// isValidSession() di code.gs lama.
//
// Catatan: sengaja TIDAK memakai generic <Database> - lihat penjelasan
// lengkap di lib/supabase/client.ts.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Dipanggil dari Server Component - boleh diabaikan jika ada
            // middleware yang me-refresh sesi.
          }
        },
      },
    }
  );
}

// Client khusus untuk operasi admin yang perlu bypass RLS
// (mis. generate rekap semua siswa). Service role key TIDAK PERNAH
// dikirim ke browser - hanya dipakai di dalam Route Handler.
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
