"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function GlobalCommand() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    router.push(normalized ? `/search?q=${encodeURIComponent(normalized)}` : "/search");
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="relative min-w-0 flex-1 md:max-w-xl"
      data-tour="global-search"
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        name="global-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск решения, показателя, модели или поручения…"
        aria-label="Глобальный поиск"
        className="h-10 w-full rounded border border-rule bg-paper pl-9 pr-3 text-base text-ink placeholder:text-ink-muted focus:border-graphite md:pr-20"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-rule bg-sheet px-1.5 py-0.5 font-technical text-meta text-ink-muted md:inline-flex">
        Ctrl K
      </kbd>
    </form>
  );
}
