// Проверенный публичный контекст АО «НАК «Казатомпром».
// Это агрегированные показатели внешней отчётности, а не данные паспортов решений.

export const COMPANY_1H2026_SOURCE =
  "Операционные и финансовые результаты Казатомпрома за 1 полугодие 2026 года";
export const COMPANY_1H2026_URL =
  "https://www.kazatomprom.kz/ru/media/view/Kazatomprom%20announces%201H2026%20Financial%20Results";
export const COMPANY_1H2026_PUBLISHED_AT = "21 августа 2026 года";

export const COMPANY_2025_REPORT_SOURCE =
  "Интегрированный годовой отчёт АО «НАК «Казатомпром» за 2025 год";
export const COMPANY_2025_REPORT_URL =
  "https://www.kazatomprom.kz/storage/4d/kap_iar_2025_final_rus.pdf";
export const COMPANY_2025_REPORT_PAGE_REFS = "стр. 72, 78–79 и 82";
export const COMPANY_PUBLIC_DATA_VERIFIED_AT = "2 сентября 2026 года";

export interface CompanyFact {
  label: string;
  value: string;
  note?: string;
  comparison?: string;
}

/** Фактические результаты за шесть месяцев, завершившихся 30 июня 2026 года. */
export const COMPANY_ACTUALS_1H2026: CompanyFact[] = [
  { label: "Консолидированная выручка", value: "717,8 млрд ₸", comparison: "+9 % г/г" },
  { label: "Чистая прибыль", value: "240,4 млрд ₸", comparison: "−9 % г/г" },
  {
    label: "Производство U3O8",
    value: "13 291 тU",
    note: "на 100 % основе",
    comparison: "+9 % г/г",
  },
  {
    label: "Производство U3O8",
    value: "7 054 тU",
    note: "на долевой основе",
    comparison: "+10 % г/г",
  },
  { label: "Объём продаж U3O8 Группы", value: "7 586 тU", comparison: "−1 % г/г" },
  {
    label: "Денежная себестоимость C1",
    value: "24,48 $/фунт",
    note: "на долевой основе",
    comparison: "+37 % г/г",
  },
  {
    label: "LTIFR",
    value: "0,11",
    note: "на 1 млн человеко-часов; 0,06 за 1П 2025",
  },
];

/** Обновлённый прогноз самой компании на полный 2026 год; это не фактические значения. */
export const COMPANY_GUIDANCE_2026: CompanyFact[] = [
  {
    label: "Курсовое допущение",
    value: "490 KZT/USD",
    note: "для расчёта обновлённого прогноза; не внутренний прогноз курса",
  },
  { label: "Производство U3O8", value: "27 500–29 000 тU", note: "на 100 % основе" },
  { label: "Производство U3O8", value: "14 500–15 500 тU", note: "на долевой основе" },
  { label: "Консолидированная выручка", value: "2 100–2 200 млрд ₸" },
  { label: "Денежная себестоимость C1", value: "25,50–27,00 $/фунт" },
  { label: "Капитальные затраты добычных предприятий", value: "435–450 млрд ₸" },
];

/** Публичные показатели цифровой трансформации за 2025 год. */
export const COMPANY_DIGITAL_FACTS_2025: CompanyFact[] = [
  { label: "Цифровая зрелость", value: "3,4 из 4", note: "методика АО «Самрук-Қазына»" },
  { label: "Автоматизированные бизнес-процессы в eKAP", value: "135" },
  { label: "RPA-роботы", value: "более 20" },
  {
    label: "Освоено по НМА и проектам цифровизации",
    value: "3 816,74 млн ₸",
    note: "без НДС",
  },
];
