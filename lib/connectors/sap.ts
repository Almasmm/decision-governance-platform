import type { Connector, ConnectorIndicatorValue } from "./types";
import { seededValue } from "./types";

export const sapConnector: Connector = {
  system: "SAP",
  async fetchIndicator(code: string): Promise<ConnectorIndicatorValue> {
    return {
      code,
      value: Math.round(seededValue(code, "sap") * 100) / 100,
      asOf: new Date(),
      sourceSystem: "SAP",
      loadType: "AUTO",
      versionNote: "Заглушка SAP ERP (демо-контур)",
    };
  },
};
