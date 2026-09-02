import type { Connector, ConnectorIndicatorValue } from "./types";
import { seededValue } from "./types";

export const powerbiConnector: Connector = {
  system: "POWERBI",
  async fetchIndicator(code: string): Promise<ConnectorIndicatorValue> {
    return {
      code,
      value: Math.round(seededValue(code, "powerbi") * 100) / 100,
      asOf: new Date(),
      sourceSystem: "POWERBI",
      loadType: "AUTO",
      versionNote: "Заглушка Power BI (демо-контур)",
    };
  },
};
