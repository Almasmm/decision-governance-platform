"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ru } from "@/lib/i18n/ru";

const DEMO_USERS: Array<{ email: string; name: string; role: keyof typeof ru.roles; hint: string }> = [
  { email: "initiator@kap.kz", name: "Динара Ахметова", role: "INITIATOR", hint: "Создаёт паспорта, заполняет блоки, отправляет на экспертизу" },
  { email: "dataowner@kap.kz", name: "Ержан Смагулов", role: "DATA_OWNER", hint: "Подтверждает качество показателей, за которые отвечает" },
  { email: "risk@kap.kz", name: "Тимур Бекетов", role: "RISK_OFFICER", hint: "Заполняет и подтверждает риск-профиль" },
  { email: "analyst@kap.kz", name: "Алия Нурланова", role: "ANALYST", hint: "Каталог показателей, реестр моделей, сценарии" },
  { email: "analyst2@kap.kz", name: "Марат Касымов", role: "ANALYST", hint: "Независимая проверка критических расчётов" },
  { email: "secretary@kap.kz", name: "Сауле Жумабаева", role: "SECRETARY", hint: "Проверяет маршрут и компетенцию органа" },
  { email: "board@kap.kz", name: "Нурлан Абишев", role: "BOARD_MEMBER", hint: "Ролевые дашборды, голосование, мотивировка" },
  { email: "admin@kap.kz", name: "Администратор", role: "ADMIN", hint: "Справочники, пользователи, правила ворот" },
];

const DEMO_PASSWORD = "demo1234";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doLogin(em: string, pw: string) {
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email: em, password: pw, redirect: false });
    setBusy(false);
    if (res?.error) {
      setError("Неверный email или пароль");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-brand text-lg font-bold text-white">DP</div>
            <div>
              <h1 className="text-xl font-bold text-brand">{ru.appName}</h1>
              <p className="text-sm text-slate-600">{ru.appSubtitle}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {ru.org} · <Badge variant="warn">{ru.demoBadge}</Badge>
          </p>
        </header>

        <div className="grid gap-8 md:grid-cols-[1fr_320px]">
          <section aria-label="Демо-пользователи">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Вход одним кликом — выберите роль
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => doLogin(u.email, DEMO_PASSWORD)}
                  disabled={busy}
                  className="rounded border border-slate-200 bg-white p-3 text-left transition hover:border-brand-accent hover:shadow-sm disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{u.name}</span>
                    <Badge>{ru.roles[u.role]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{u.hint}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{u.email}</p>
                </button>
              ))}
            </div>
          </section>

          <section aria-label="Форма входа">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Вход по email и паролю
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void doLogin(email, password);
              }}
              className="rounded border border-slate-200 bg-white p-4"
            >
              <Label htmlFor="email">{ru.common.email}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="initiator@kap.kz" autoComplete="username" />
              <div className="mt-3">
                <Label htmlFor="password">{ru.common.password}</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="demo1234" autoComplete="current-password" />
              </div>
              {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
              <Button type="submit" className="mt-4 w-full" disabled={busy}>
                {busy ? "Вход…" : ru.common.login}
              </Button>
              <p className="mt-3 text-xs text-slate-400">Пароль всех демо-аккаунтов: demo1234</p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
