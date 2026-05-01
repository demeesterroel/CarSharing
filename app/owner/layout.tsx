"use client";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { paper } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const year = new Date().getFullYear();
  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <Suspense>
        <PageHeader title={t("owner.title")} subtitle={t("owner.subtitle", { year })} />
      </Suspense>
      {children}
    </div>
  );
}
