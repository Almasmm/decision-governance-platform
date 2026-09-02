// Диспетчер коннекторов: fetchIndicator(code) находит показатель в каталоге
// и опрашивает соответствующий источник. MANUAL/EXTERNAL автозагрузку не поддерживают.
import { prisma } from "../prisma";
import type { SourceSystem } from "../domain";
import type { Connector, ConnectorIndicatorValue } from "./types";
import { sapConnector } from "./sap";
import { ekapConnector } from "./ekap";
import { powerbiConnector } from "./powerbi";
import { dwhConnector } from "./dwh";

const connectors: Partial<Record<SourceSystem, Connector>> = {
  SAP: sapConnector,
  EKAP: ekapConnector,
  POWERBI: powerbiConnector,
  DWH: dwhConnector,
};

export async function fetchIndicator(code: string): Promise<ConnectorIndicatorValue> {
  const indicator = await prisma.indicator.findUnique({ where: { code } });
  if (!indicator) throw new Error(`Показатель ${code} не найден в каталоге`);
  const connector = connectors[indicator.sourceSystem as SourceSystem];
  if (!connector)
    throw new Error(
      `Источник ${indicator.sourceSystem} не поддерживает автозагрузку — требуется ручной ввод`
    );
  return connector.fetchIndicator(code);
}

export { connectors };
export type { Connector, ConnectorIndicatorValue };
