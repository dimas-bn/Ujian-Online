"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";

interface Item {
  id: string;
  name: string;
}

function DataSection({
  title,
  apiPath,
  items,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  apiPath: string;
  items: Item[];
  loading: boolean;
  onAdd: (name: string) => Promise<void>;
  onEdit: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    await onAdd(newName.trim());
    setNewName("");
    setSubmitting(false);
  }

  async function handleEdit(item: Item) {
    const { value: name } = await Swal.fire({
      title: `Ubah ${title}`,
      input: "text",
      inputValue: item.name,
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
    });
    if (name && name.trim() && name.trim() !== item.name) {
      await onEdit(item.id, name.trim());
    }
  }

  async function handleDelete(item: Item) {
    const confirm = await Swal.fire({
      title: `Hapus "${item.name}"?`,
      text: "Tindakan ini tidak bisa dibatalkan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
    });
    if (confirm.isConfirmed) {
      await onDelete(item.id);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-800 mb-4">{title}</h2>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder={`Tambah ${title.toLowerCase()} baru...`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={submitting || !newName.trim()}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
        >
          Tambah
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400">Memuat...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada data.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-slate-700">{item.name}</span>
              <div className="flex gap-3 text-sm">
                <button onClick={() => handleEdit(item)} className="text-blue-600 hover:underline">
                  Ubah
                </button>
                <button onClick={() => handleDelete(item)} className="text-red-600 hover:underline">
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MasterDataPage() {
  const [classes, setClasses] = useState<Item[]>([]);
  const [subjects, setSubjects] = useState<Item[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  async function loadClasses() {
    setLoadingClasses(true);
    const res = await fetch("/api/classes");
    const data = await res.json();
    if (res.ok) setClasses(data.classes);
    setLoadingClasses(false);
  }

  async function loadSubjects() {
    setLoadingSubjects(true);
    const res = await fetch("/api/subjects");
    const data = await res.json();
    if (res.ok) setSubjects(data.subjects);
    setLoadingSubjects(false);
  }

  useEffect(() => {
    loadClasses();
    loadSubjects();
  }, []);

  async function callApi(url: string, options: RequestInit) {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
      Swal.fire("Gagal", data.message ?? "Terjadi kesalahan.", "error");
      return false;
    }
    return true;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">Master Data</h1>
      <p className="text-slate-500 text-sm mb-6">Kelola daftar kelas dan mata pelajaran yang dipakai di seluruh aplikasi.</p>

      <div className="grid md:grid-cols-2 gap-6">
        <DataSection
          title="Kelas"
          apiPath="/api/classes"
          items={classes}
          loading={loadingClasses}
          onAdd={async (name) => {
            if (await callApi("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })) {
              loadClasses();
            }
          }}
          onEdit={async (id, name) => {
            if (await callApi(`/api/classes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })) {
              loadClasses();
            }
          }}
          onDelete={async (id) => {
            if (await callApi(`/api/classes/${id}`, { method: "DELETE" })) {
              loadClasses();
            }
          }}
        />

        <DataSection
          title="Mata Pelajaran"
          apiPath="/api/subjects"
          items={subjects}
          loading={loadingSubjects}
          onAdd={async (name) => {
            if (await callApi("/api/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })) {
              loadSubjects();
            }
          }}
          onEdit={async (id, name) => {
            if (await callApi(`/api/subjects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })) {
              loadSubjects();
            }
          }}
          onDelete={async (id) => {
            if (await callApi(`/api/subjects/${id}`, { method: "DELETE" })) {
              loadSubjects();
            }
          }}
        />
      </div>
    </div>
  );
}
