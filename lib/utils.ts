import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatMoney(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} млрд ₸`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} млн ₸`;
  return `${v.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₸`;
}

export function formatNumber(v: number, digits = 2): string {
  return v.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}
