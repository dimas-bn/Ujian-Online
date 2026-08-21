import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ujian Online",
  description: "Sistem Ujian Online",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-slate-50 min-h-screen">{children}</body>
    </html>
  );
}
