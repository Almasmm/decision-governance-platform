"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ChevronRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ru } from "@/lib/i18n/ru";

type RoleKey = keyof typeof ru.roles;

interface DemoUser {
  email: string;
  name: string;
  role: RoleKey;
  hint: string;
}

const ROLE_GROUPS: Array<{ label: string; note: string; users: DemoUser[] }> = [
  {
    label: "Подготовка",
    note: "Формирует вопрос и его доказательную базу",
    users: [
      { email: "initiator@kap.kz", name: "Динара Ахметова", role: "INITIATOR", hint: "Создание паспорта и подготовка вопроса" },
      { email: "dataowner@kap.kz", name: "Ержан Смагулов", role: "DATA_OWNER", hint: "Качество и происхождение данных" },
      { email: "analyst@kap.kz", name: "Алия Нурланова", role: "ANALYST", hint: "Сценарии, показатели и модели" },
      { email: "analyst2@kap.kz", name: "Марат Касымов", role: "ANALYST", hint: "Независимая проверка расчётов" },
    ],
  },
  {
    label: "Экспертиза",
    note: "Проверяет риск и корректность маршрута",
    users: [
      { email: "risk@kap.kz", name: "Тимур Бекетов", role: "RISK_OFFICER", hint: "Риск-профиль и остаточный риск" },
      { email: "secretary@kap.kz", name: "Сауле Жумабаева", role: "SECRETARY", hint: "Маршрут и компетенция органа" },
    ],
  },
  {
    label: "Решение",
    note: "Фиксирует мотивированный человеческий вердикт",
    users: [
      { email: "board@kap.kz", name: "Нурлан Абишев", role: "BOARD_MEMBER", hint: "Выбор, мотивировка и голосование" },
    ],
  },
  {
    label: "Контроль",
    note: "Управляет правилами и прозрачностью контура",
    users: [
      { email: "admin@kap.kz", name: "Администратор", role: "ADMIN", hint: "Полномочия, справочники и gates" },
    ],
  },
];

const LIFECYCLE = [
  "Проблема",
  "Данные",
  "Альтернативы",
  "Риски",
  "Решение",
  "Исполнение",
  "Обратная связь",
];

const DEMO_PASSWORD = "demo1234";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  async function doLogin(em: string, pw: string) {
    setBusyEmail(em);
    setError(null);
    try {
      const res = await signIn("credentials", { email: em, password: pw, redirect: false });
      if (res?.error) {
        setError("Неверный email или пароль");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Не удалось подключиться к контуру. Повторите попытку.");
    } finally {
      setBusyEmail(null);
    }
  }

  const roleGroup = (group: (typeof ROLE_GROUPS)[number]) => (
    <section key={group.label} aria-labelledby={`role-${group.label}`}>
      <div className="mb-2">
        <h2 id={`role-${group.label}`} className="font-ui text-section font-semibold text-ink">
          {group.label}
        </h2>
        <p className="text-meta text-ink-muted">{group.note}</p>
      </div>
      <div className="border-t border-rule">
        {group.users.map((user) => {
          const busy = busyEmail === user.email;
          return (
            <button
              key={user.email}
              type="button"
              onClick={() => void doLogin(user.email, DEMO_PASSWORD)}
              disabled={busyEmail !== null}
              className="group grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-rule px-1 py-2.5 text-left transition-colors duration-150 hover:bg-paper disabled:cursor-wait disabled:opacity-50"
              aria-label={busy ? `Выполняется вход как ${user.name}, ${ru.roles[user.role]}` : `Войти как ${user.name}, ${ru.roles[user.role]}`}
              aria-busy={busy}
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-base font-semibold text-ink">{user.name}</span>
                  <span className="text-meta font-medium text-graphite">{ru.roles[user.role]}</span>
                </span>
                <span className="mt-0.5 block text-meta text-ink-muted">
                  {busy ? "Открываем рабочий контур…" : user.hint}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-graphite"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <main className="min-h-screen bg-sheet">
      <div className="grid min-h-screen lg:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.18fr)]">
        <section className="flex bg-graphite px-7 py-8 text-paper sm:px-10 lg:min-h-screen lg:px-12 lg:py-10 xl:px-16">
          <div className="mx-auto flex w-full max-w-xl flex-col">
            <header className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded border border-graphite-line font-technical text-base font-bold">
                DP
              </div>
              <div>
                <p className="text-lead font-semibold">{ru.appName}</p>
                <p className="text-meta text-rule-strong">Executive Decision Intelligence</p>
              </div>
            </header>

            <div className="mt-8 lg:mt-10">
              <h1 className="max-w-lg font-ui text-page font-semibold tracking-[-0.02em] text-paper">
                Качество корпоративного решения — управляемый контур
              </h1>
              <p className="mt-3 max-w-lg text-lead text-rule-strong">
                Платформа связывает доказательства, риск, полномочия и исполнение в один проверяемый жизненный цикл.
              </p>
            </div>

            <ol className="mt-7 grid grid-cols-2 gap-x-5 gap-y-0 sm:grid-cols-4 lg:grid-cols-1" aria-label="Жизненный цикл решения">
              {LIFECYCLE.map((stage, index) => (
                <li key={stage} className="relative flex min-h-9 items-center gap-3 lg:min-h-10">
                  {index < LIFECYCLE.length - 1 && (
                    <span className="absolute left-[13px] top-7 hidden h-5 w-px bg-graphite-line lg:block" aria-hidden="true" />
                  )}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-graphite-line font-technical text-meta text-rule-strong">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-base font-medium text-paper">{stage}</span>
                </li>
              ))}
            </ol>

            <div className="mt-7 border-l-2 border-rule-strong pl-4">
              <p className="text-base font-semibold text-paper">
                Данные → Аналитика → Рекомендация → Решение человека
              </p>
              <p className="mt-1 text-meta text-rule-strong">
                Система проверяет готовность и объясняет варианты. Финальное полномочие всегда остаётся у человека или органа управления.
              </p>
            </div>

            <footer className="mt-auto pt-8 text-meta text-rule-strong">
              <p>{ru.org}</p>
              <p className="mt-1">Демонстрационный контур · синтетические данные решений</p>
            </footer>
          </div>
        </section>

        <section className="px-5 py-7 sm:px-8 lg:px-10 lg:py-9 xl:px-14" aria-label="Выбор роли">
          <div className="mx-auto max-w-4xl">
            <header className="border-b border-rule pb-5">
              <p className="text-meta font-semibold text-graphite">Демонстрационный доступ</p>
              <h2 className="mt-1 font-ui text-page font-semibold text-ink">Выберите роль в контуре</h2>
              <p className="mt-2 max-w-2xl text-base text-ink-muted">
                Каждая роль видит одну и ту же доказательную базу через собственные полномочия и следующий обязательный шаг.
              </p>
            </header>

            {error && (
              <p role="alert" className="mt-4 border-l-2 border-signal bg-signal-tint px-3 py-2 text-base text-signal">
                {error}
              </p>
            )}

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {roleGroup(ROLE_GROUPS[0]!)}
              <div className="space-y-5">
                {ROLE_GROUPS.slice(1).map(roleGroup)}
              </div>
            </div>

            <details className="mt-7 border-t border-rule pt-4">
              <summary className="inline-flex cursor-pointer items-center gap-2 text-base font-semibold text-graphite">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                Войти по email и паролю
              </summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void doLogin(email, password);
                }}
                className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <div>
                  <Label htmlFor="email">{ru.common.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="initiator@kap.kz"
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">{ru.common.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={DEMO_PASSWORD}
                    autoComplete="current-password"
                    aria-describedby="demo-password-hint"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busyEmail !== null}
                  aria-busy={Boolean(busyEmail === email && email)}
                >
                  {busyEmail === email && email ? "Вход…" : ru.common.login}
                </Button>
              </form>
              <p id="demo-password-hint" className="mt-2 text-meta text-ink-muted">Пароль всех демо-аккаунтов: {DEMO_PASSWORD}</p>
            </details>
          </div>
        </section>
      </div>
    </main>
  );
}
