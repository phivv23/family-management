import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hệ thống quản lý dòng họ",
  description: "Phần mềm quản lý dòng họ, tài khoản và tư liệu số",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
