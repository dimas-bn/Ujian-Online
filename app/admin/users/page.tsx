"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";

interface ClassRow {
  id: string;
  name: string;
}

interface User {
  id: string;
  user_code: string;
  name: string;
  role: "admin" | "guru" | "siswa";
  is_active: boolean;
  classes: { id: string; name: string } | null;
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", guru: "Guru", siswa: "Siswa" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("semua");
  const [showForm, setShowForm] = useState(false);

  const [userCode, setUserCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "guru" | "siswa">("siswa");
  const [classId, setClassId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [usersRes, classesRes] = await Promise.all([fetch("/api/users"), fetch("/api/classes")]);
    const usersData = await usersRes.json();
    const classesData = await classesRes.json();
    if (usersRes.ok) setUsers(usersData.users);
    if (classesRes.ok) setClasses(classesData.classes);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_code: userCode, name, role, class_id: classId || null, password }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      Swal.fire("Gagal", data.message ?? "Terjadi kesalahan.", "error");
      return;
    }

    setShowForm(false);
    setUserCode("");
    setName("");
    setRole("siswa");
    setClassId("");
    setPassword("");
    loadAll();
  }

  async function toggleActive(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    if (res.ok) loadAll();
  }

  async function handleResetPassword(u: User) {
    const { value: newPassword } = await Swal.fire({
      title: `Reset password ${u.name}`,
      input: "text",
      inputPlaceholder: "Password baru (minimal 6 karakter)",
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
    });
    if (!newPassword) return;

    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      Swal.fire("Gagal", data.message ?? "Terjadi kesalahan.", "error");
    } else {
      Swal.fire("Berhasil", "Password sudah diperbarui.", "success");
    }
  }

  async function handleDelete(u: User) {
    const confirm = await Swal.fire({
      title: `Hapus akun "${u.name}"?`,
      text: "Tindakan ini tidak bisa dibatalkan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
    });
    if (!confirm.isConfirmed) return;

    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      Swal.fire("Gagal", data.message ?? "Terjadi kesalahan.", "error");
    } else {
      loadAll();
    }
  }

  const filteredUsers = filterRole === "semua" ? users : users.filter((u) => u.role === filterRole);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pengguna</h1>
          <p className="text-slate-500 text-sm">Kelola akun admin, guru, dan siswa.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
        >
          {showForm ? "Batal" : "+ Tambah Pengguna"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">UserID</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                placeholder="mis. siswa01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nama Lengkap</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Role</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "guru" | "siswa")}
              >
                <option value="siswa">Siswa</option>
                <option value="guru">Guru</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {role === "siswa" && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Kelas</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  required
                >
                  <option value="">Pilih kelas...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Password Awal</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan Pengguna"}
          </button>
        </form>
      )}

      <div className="flex gap-2 mb-4">
        {["semua", "admin", "guru", "siswa"].map((r) => (
          <button
            key={r}
            onClick={() => setFilterRole(r)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              filterRole === r ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300"
            }`}
          >
            {r === "semua" ? "Semua" : ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Memuat...</p>
      ) : filteredUsers.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada pengguna.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3">UserID</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-mono text-xs">{u.user_code}</td>
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                  <td className="px-4 py-3">{u.classes?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {u.is_active ? "Aktif" : "Nonaktif"}
                    </button>
                  </td>
                  <td className="px-4 py-3 space-x-3">
                    <button onClick={() => handleResetPassword(u)} className="text-blue-600 hover:underline">
                      Reset Password
                    </button>
                    <button onClick={() => handleDelete(u)} className="text-red-600 hover:underline">
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
