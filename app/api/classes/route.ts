import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

// Helper kecil: pastikan yang memanggil API ini benar admin/guru yang sudah
// login. Halaman /admin/* sudah dijaga oleh admin/layout.tsx, tapi API route
// adalah pintu masuk terpisah - siapa pun bisa langsung memanggilnya lewat
// fetch/console tanpa lewat halaman, jadi validasi di sini WAJIB ada sendiri
// (ini persis kelas bug yang ditemukan di audit code.gs lama: syncAnswers/
// submitExam tidak validasi token sama sekali).
async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "guru")) return null;

  return profile;
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });
  }

  const db = createServiceRoleClient();
  const { data, error } = await db.from("classes").select("*").order("name");

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ classes: data });
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ message: "Hanya admin yang boleh menambah kelas." }, { status: 403 });
  }

  const { name } = await request.json();
  if (!name || !String(name).trim()) {
    return NextResponse.json({ message: "Nama kelas tidak boleh kosong." }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data, error } = await db.from("classes").insert({ name: String(name).trim() }).select().single();

  if (error) {
    const message = error.message.includes("duplicate") ? "Nama kelas sudah ada." : error.message;
    return NextResponse.json({ message }, { status: 400 });
  }
  return NextResponse.json({ class: data });
}
