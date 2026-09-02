// Сквозной аудит: каждая мутация паспорта, подтверждение данных и вердикт по ИИ
// пишутся в AuditEvent.
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditParams {
  entity: string;
  entityId: string;
  action: string;
  actorId: string;
  before?: unknown;
  after?: unknown;
}

export async function writeAudit(db: Db, p: AuditParams): Promise<void> {
  await db.auditEvent.create({
    data: {
      entity: p.entity,
      entityId: p.entityId,
      action: p.action,
      actorId: p.actorId,
      before: p.before === undefined ? null : JSON.stringify(p.before),
      after: p.after === undefined ? null : JSON.stringify(p.after),
    },
  });
}
