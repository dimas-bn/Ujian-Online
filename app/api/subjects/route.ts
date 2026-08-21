import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

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
  const { data, error } = await db.from("subjects").select("*").order("name");

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ subjects: data });
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ message: "Hanya admin yang boleh menambah mapel." }, { status: 403 });
  }

  const { name } = await request.json();
  if (!name || !String(name).trim()) {
    return NextResponse.json({ message: "Nama mapel tidak boleh kosong." }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data, error } = await db.from("subjects").insert({ name: String(name).trim() }).select().single();

  if (error) {
    const message = error.message.includes("duplicate") ? "Nama mapel sudah ada." : error.message;
    return NextResponse.json({ message }, { status: 400 });
  }
  return NextResponse.json({ subject: data });
}
