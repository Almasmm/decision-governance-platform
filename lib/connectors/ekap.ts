import type { Connector, ConnectorIndicatorValue } from "./types";
import { seededValue } from "./types";

export const ekapConnector: Connector = {
  system: "EKAP",
  async fetchIndicator(code: string): Promise<ConnectorIndicatorValue> {
    return {
      code,
      value: Math.round(seededValue(code, "ekap") * 100) / 100,
      asOf: new Date(),
      sourceSystem: "EKAP",
      loadType: "AUTO",
      versionNote: "Заглушка eKAP (демо-контур)",
    };
  },
};
