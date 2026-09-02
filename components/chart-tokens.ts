// Единственное место, где токены доступны как литералы: Recharts и SVG
// не понимают CSS-переменные в атрибутах. Значения обязаны совпадать
// с app/globals.css. Ни один компонент не задаёт цвет мимо этого модуля.

export const T = {
  canvas: "#f2f5f4",
  surface: "#ffffff",
  surfaceRaised: "#e7ecea",
  text: "#172023",
  textMuted: "#637074",
  obsidian: "#10191c",
  obsidianSoft: "#243034",
  accent: "#356f62",
  accentSoft: "#ddebe6",
  action: "#b45d2d",
  actionSoft: "#f6e6dc",
  line: "#d5ddda",
  lineStrong: "#aebbb7",
  success: "#2f7559",
  danger: "#aa3f46",
  actionStep1: "#f8eee8",
  actionStep2: "#e9c9b7",
  actionStep3: "#cf8e69",

  // Aliases keep existing chart code readable while it migrates.
  paper: "#f2f5f4",
  sheet: "#ffffff",
  ink: "#172023",
  inkMuted: "#637074",
  graphite: "#10191c",
  graphiteSoft: "#243034",
  signal: "#b45d2d",
  signalTint: "#f6e6dc",
  rule: "#d5ddda",
  ruleStrong: "#aebbb7",
  signalStep1: "#f8eee8",
  signalStep2: "#e9c9b7",
  signalStep3: "#cf8e69",
} as const;

/** Общие настройки осей и подсказок: один вид у всех графиков. */
export const axisTick = { fontSize: 12, fill: T.inkMuted } as const;
export const axisLabelTick = { fontSize: 12, fill: T.ink } as const;
export const gridStroke = T.rule;
export const tooltipStyle = {
  fontSize: 13,
  borderRadius: 8,
  border: `1px solid ${T.line}`,
  background: T.surface,
  color: T.text,
  boxShadow: "0 12px 32px rgb(16 25 28 / 0.14)",
  fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
} as const;

/**
 * Значения серий по яркости, а не по оттенку: серии различимы
 * в оттенках серого и на проекторе. Цвет дополняется штриховкой
 * на стороне компонента — цвет не единственный носитель смысла.
 */
export const SERIES = [T.obsidian, T.accent, T.textMuted, T.action, T.lineStrong] as const;

/** Штриховка линий по индексу серии — второй, независимый от цвета признак. */
export const SERIES_DASH = [undefined, "5 3", "2 3", "8 3", "1 3"] as const;
