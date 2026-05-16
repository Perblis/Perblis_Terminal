"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { ownerSettingsApi } from "@/lib/api/owner";
import { QUERY_KEYS } from "@/lib/constants";

const schema = z.object({
  business_name: z.string().min(2, "Required."),
  business_description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function BusinessProfilePage() {
  const qc = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const q = useQuery({
    queryKey: QUERY_KEYS.businessProfile,
    queryFn: () => ownerSettingsApi.getProfile().then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (q.data) {
      reset({
        business_name: q.data.business_name ?? "",
        business_description: q.data.business_description ?? "",
      });
    }
  }, [q.data, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => ownerSettingsApi.patchProfile(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.businessProfile }),
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("business_logo", file);
      return ownerSettingsApi.patchProfile(fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.businessProfile }),
  });

  if (q.isLoading) return <Skeleton className="h-[400px]" />;

  return (
    <>
      <PageHeader title="Business profile" description="Shown to renters on your listings." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[920px]">
        <Card className="lg:col-span-1 space-y-3">
          <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Logo</div>
          <div className="w-32 h-32 rounded-card overflow-hidden border border-border bg-surface-elevated grid place-items-center">
            {q.data?.business_logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={q.data.business_logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.06em]">
                No logo
              </span>
            )}
          </div>
          <input
            ref={logoInputRef}
            data-testid="business-logo-file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadLogo.mutate(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => logoInputRef.current?.click()}
          >
            {uploadLogo.isPending ? "Uploading\u2026" : "Upload logo"}
          </Button>
        </Card>

        <Card className="lg:col-span-2 space-y-4">
          <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
            <Field id="business_name" label="Business name" error={errors.business_name?.message}>
              <Input
                id="business_name"
                {...register("business_name")}
                invalid={!!errors.business_name}
              />
            </Field>
            <Field
              id="business_description"
              label="Description"
              hint="Renters see this on every listing."
            >
              <textarea
                id="business_description"
                rows={5}
                {...register("business_description")}
                className="w-full rounded border border-border bg-surface-elevated p-3 text-[14px] font-body"
              />
            </Field>
            <div>
              <Button type="submit" disabled={isSubmitting || save.isPending}>
                {save.isPending ? "Saving\u2026" : "Save"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
