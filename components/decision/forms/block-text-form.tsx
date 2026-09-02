"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, LockKeyhole, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  for (const field of fields) {
    shape[field.key] = field.required ? z.string().min(1, "Обязательное поле") : z.string();
  }
  const schema = z.object(shape);
  type Values = Record<string, string>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      fields.map((field) => [field.key, initial[field.key] ?? ""])
    ) as Values,
  });

  if (disabled) {
    return (
      <div className="space-y-0">
        {fields.map((field) => {
          const value = initial[field.key];
          return (
            <section key={field.key} className="border-t border-line py-4 first:border-t-0 first:pt-0">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-table font-semibold text-text">{field.label}</h3>
                {field.required && <Badge variant={value ? "resolvedSoft" : "action"}>Обязательно</Badge>}
              </div>
              <p
                id={`${kind}-${field.key}`}
                className={
                  value
                    ? "whitespace-pre-line text-base text-text"
                    : "border-l-2 border-action bg-action-soft px-3 py-2 text-table font-semibold text-action"
                }
              >
                {value || "Не заполнено"}
              </p>
            </section>
          );
        })}
        <p className="flex items-start gap-2 border-t border-line pt-4 text-meta text-muted">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Редактирование блока доступно инициатору, аналитику и администратору. Текущие данные
          показаны в режиме чтения.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        setSaved(false);
        const result = await updateBlockPayload(decisionId, kind, { ...initial, ...values });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSaved(true);
        router.refresh();
      })}
      className="space-y-0"
    >
      {fields.map((field) => {
        const errorId = `${kind}-${field.key}-error`;
        const fieldError = errors[field.key];
        return (
          <div key={field.key} className="border-t border-line py-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={`${kind}-${field.key}`} className="mb-1.5">
                {field.label}
              </Label>
              {field.required && <Badge variant="partial">Обязательное evidence</Badge>}
            </div>
            <Textarea
              id={`${kind}-${field.key}`}
              placeholder={field.placeholder}
              aria-invalid={fieldError ? "true" : undefined}
              aria-describedby={fieldError ? errorId : undefined}
              {...register(field.key)}
            />
            {fieldError && (
              <p id={errorId} className="mt-1 text-table text-action" role="alert">
                {String(fieldError.message ?? "")}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
        <Button type="submit" disabled={isSubmitting}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Сохранение…" : "Сохранить блок"}
        </Button>
        <p className="text-meta text-muted">
          Изменение сохраняется в evidence dossier и фиксируется в audit trail.
        </p>
      </div>

      <div className="mt-3 min-h-5" aria-live="polite">
        {error && (
          <p className="text-table text-action" role="alert">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="inline-flex items-center gap-1.5 text-table font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Сохранено
          </p>
        )}
      </div>
    </form>
  );
}
