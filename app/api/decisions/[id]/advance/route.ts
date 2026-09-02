// POST /api/decisions/:id/advance — единственная точка перехода на следующую стадию.
// Прогоняет применимые GateCheck; при блокировке возвращает чек-лист с объяснениями.
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { advanceDecisionStage } from "@/lib/gate-service";
import { AccessDeniedError } from "@/lib/authz";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Не выполнен вход" }, { status: 401 });

  const { id } = await params;
  try {
    const outcome = await advanceDecisionStage(id, { id: user.id, role: user.role });
    if (outcome.ok) {
      return NextResponse.json({
        ok: true,
        fromStage: outcome.fromStage,
        toStage: outcome.toStage,
        results: outcome.evaluation.results,
      });
    }
    const status = outcome.reason === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json(
      {
        ok: false,
        reason: outcome.reason,
        message: outcome.message,
        results: outcome.evaluation?.results ?? [],
      },
      { status }
    );
  } catch (e) {
    if (e instanceof AccessDeniedError)
      return NextResponse.json({ ok: false, message: e.message }, { status: 403 });
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Ошибка перехода" },
      { status: 500 }
    );
  }
}
