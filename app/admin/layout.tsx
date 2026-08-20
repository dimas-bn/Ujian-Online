import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const MENU = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/master-data", label: "Master Data" },
  { href: "/admin/exams", label: "Ujian" },
  { href: "/admin/results", label: "Hasil" },
  { href: "/admin/users", label: "Pengguna" },
  { href: "/admin/monitor", label: "Monitoring" },
  { href: "/admin/images", label: "Bank Gambar" },
  { href: "/admin/config", label: "Konfigurasi" },
];

// Role guard terpusat - dulu verifyAdminAccess()/checkUserAccess() harus
// dipanggil manual di SETIAP fungsi backend di code.gs (rawan lupa
// ditambahkan di fungsi baru). Di sini cukup satu tempat untuk semua
// halaman di bawah /admin/*.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role, name").eq("auth_id", user.id).single();

  if (!profile || (profile.role !== "admin" && profile.role !== "guru")) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 text-slate-200 p-4 flex flex-col gap-1">
        <div className="text-white font-bold mb-4 px-2">Ujian Online</div>
        {MENU.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-lg hover:bg-slate-800 text-sm"
          >
            {item.label}
          </Link>
        ))}
        <div className="mt-auto text-xs text-slate-400 px-2 pt-4 border-t border-slate-800">
          {profile.name} ({profile.role})
        </div>
      </aside>
      <main className="flex-1 p-6 bg-slate-50">{children}</main>
    </div>
  );
}
