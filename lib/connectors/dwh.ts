import type { Connector, ConnectorIndicatorValue } from "./types";
import { seededValue } from "./types";

export const dwhConnector: Connector = {
  system: "DWH",
  async fetchIndicator(code: string): Promise<ConnectorIndicatorValue> {
    return {
      code,
      value: Math.round(seededValue(code, "dwh") * 100) / 100,
      asOf: new Date(),
      sourceSystem: "DWH",
      loadType: "AUTO",
      versionNote: "Заглушка корпоративного хранилища данных (демо-контур)",
    };
  },
};
