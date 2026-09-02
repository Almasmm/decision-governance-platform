"use client";

// Форма текстовых полей блока паспорта (payload). react-hook-form + zod.
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { updateBlockPayload } from "@/app/actions/decisions";
import type { BlockKind } from "@/lib/domain";

export interface TextField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export function BlockTextForm({
  decisionId,
  kind,
  fields,
  initial,
  disabled,
}: {
  decisionId: string;
  kind: BlockKind;
  fields: TextField[];
  initial: Record<string, string>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    shape[f.key] = f.required ? z.string().min(1, "Обязательное поле") : z.string();
  }
  const schema = z.object(shape);
  type Values = Record<string, string>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? ""])) as Values,
  });

  if (disabled) {
    return (
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <p className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700">
              {initial[f.key] || <span className="text-brand-warn">Не заполнено</span>}
            </p>
          </div>
        ))}
        <p className="text-xs text-slate-500">
          Редактирование блоков доступно инициатору, аналитику и администратору.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        setSaved(false);
        const res = await updateBlockPayload(decisionId, kind, { ...initial, ...values });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSaved(true);
        router.refresh();
      })}
      className="space-y-3"
    >
      {fields.map((f) => (
        <div key={f.key}>
          <Label htmlFor={`${kind}-${f.key}`}>{f.label}</Label>
          <Textarea id={`${kind}-${f.key}`} placeholder={f.placeholder} {...register(f.key)} />
          {errors[f.key] && (
            <p className="mt-1 text-xs text-red-700">{String(errors[f.key]?.message ?? "")}</p>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-red-700">{error}</p>}
      {saved && <p className="text-xs text-emerald-700">Сохранено</p>}
      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? "Сохранение…" : "Сохранить блок"}
      </Button>
    </form>
  );
}
