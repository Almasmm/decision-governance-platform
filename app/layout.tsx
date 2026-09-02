import type { Metadata } from "next";
import "./globals.css";
import { ru } from "@/lib/i18n/ru";

export const metadata: Metadata = {
  title: `${ru.appName} — ${ru.appSubtitle}`,
  description: "Цифровой паспорт управленческого решения: данные, альтернативы, риски, ворота, пост-оценка.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
