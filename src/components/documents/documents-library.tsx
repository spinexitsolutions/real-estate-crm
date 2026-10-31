"use client";

import { FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/card";
import { DocRow, type DocItem } from "./documents-client";

export type LibraryItem = DocItem & { context: { href: string; label: string; sub?: string } | null; shareable: boolean };

export function DocumentsLibrary({ items }: { items: LibraryItem[] }) {
  if (!items.length) return <EmptyState icon={FolderOpen} title="No documents found" description="Upload documents from a lead or booking page. Try clearing the filters." />;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((d) => (
        <DocRow key={d.id} doc={d} canShare={d.shareable} context={d.context ?? undefined} />
      ))}
    </ul>
  );
}
