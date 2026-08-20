import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// Dipakai di Server Component / Route Handler (app/api/**/route.ts).
// Client ini otomatis membaca sesi dari cookie request yang masuk, sehingga
// setiap query ke Postgres berjalan "sebagai" user yang login -> RLS policy
// di schema.sql (siswa hanya boleh akses responses miliknya sendiri) berlaku
// otomatis di level database, tanpa perlu dicek manual di tiap fungsi seperti
// isValidSession() di code.gs lama.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
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
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
