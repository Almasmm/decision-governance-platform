import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz";
import { NewDecisionForm } from "@/components/decision/new-decision-form";

export const dynamic = "force-dynamic";

export default async function NewDecisionPage() {
  const user = await requireUser();
  if (!can(user.role, "decision.create")) redirect("/decisions");

  const bodies = await prisma.decisionBody.findMany({ orderBy: { name: "asc" } });

  return <NewDecisionForm bodies={bodies.map((b) => ({ id: b.id, name: b.name }))} />;
}
