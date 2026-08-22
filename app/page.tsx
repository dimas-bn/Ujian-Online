import { redirect } from "next/navigation";

// Alamat utama (ujiand.web.id/) belum punya tampilan sendiri - daripada 404,
// arahkan otomatis ke halaman login. Kalau nanti mau bikin landing page yang
// lebih informatif, cukup ganti isi file ini.
export default function HomePage() {
  redirect("/login");
}
