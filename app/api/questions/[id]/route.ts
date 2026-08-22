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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const db = createServiceRoleClient();

  const updatable: Record<string, unknown> = {};
  for (const key of ["type", "content", "options", "correct_answer", "weight", "is_required"]) {
    if (key in body) updatable[key] = body[key];
  }

  const { data, error } = await db.from("questions").update(updatable).eq("id", id).select().single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ question: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });

  const { id } = await params;
  const db = createServiceRoleClient();
  const { error } = await db.from("questions").delete().eq("id", id);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
