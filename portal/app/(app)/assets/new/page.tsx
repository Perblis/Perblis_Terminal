"use client";

import { PageHeader } from "@/components/shell/page-header";
import { AssetForm } from "@/components/assets/asset-form";

export default function NewAssetPage() {
  return (
    <>
      <PageHeader title="Add asset" crumbs={[{ label: "Assets", href: "/assets" }, { label: "New" }]} />
      <AssetForm />
    </>
  );
}
