// Единый контракт коннекторов к источникам данных.
// Сейчас — детерминированные заглушки; для боевого контура подменяются
// реализациями с реальными API SAP/eKAP/Power BI/DWH при том же интерфейсе.
import type { SourceSystem } from "../domain";

export interface ConnectorIndicatorValue {
  code: string;
  value: number;
  asOf: Date;
  sourceSystem: SourceSystem;
  loadType: "AUTO" | "MANUAL";
  versionNote?: string;
}

export interface Connector {
  system: SourceSystem;
  fetchIndicator(code: string): Promise<ConnectorIndicatorValue>;
}

/** Детерминированный псевдослучайный генератор из строки (для стабильных демо-значений). */
export function seededValue(code: string, salt: string): number {
  let h = 2166136261;
  const s = `${code}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 100000) / 100;
}
