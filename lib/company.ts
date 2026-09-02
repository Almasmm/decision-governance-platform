// Публичные показатели АО «НАК «Казатомпром» из интегрированного годового отчёта 2025.
// В отличие от синтетических демо-цифр внутри решений, это данные публичной отчётности.

export const COMPANY_REPORT_SOURCE = "Интегрированный годовой отчёт АО «НАК «Казатомпром» за 2025 год";
export const COMPANY_REPORT_URL = "https://www.kazatomprom.kz/ru/investoram/godovie_otcheti";

export interface CompanyFact {
  label: string;
  value: string;
  note?: string;
}

export const COMPANY_FACTS_2025: CompanyFact[] = [
  { label: "Доля в мировом первичном производстве урана", value: "≈ 20 %" },
  { label: "Производство урана", value: "13 519 т", note: "в пересчёте на 100 % долю" },
  { label: "Выручка", value: "1 803 млрд ₸" },
  { label: "Чистая прибыль", value: "806,7 млрд ₸" },
  { label: "Численность работников", value: "22 947 чел." },
  { label: "Цифровая зрелость", value: "3,4 из 4", note: "методика АО «Самрук-Қазына»" },
  { label: "Автоматизированные бизнес-процессы в eKAP", value: "135" },
  { label: "RPA-роботы", value: "более 20" },
  { label: "Освоено на цифровизацию", value: "3 816,74 млн ₸", note: "без НДС" },
  { label: "Совет директоров", value: "7 человек", note: "из них 3 независимых директора" },
];
