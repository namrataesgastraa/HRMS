"use client";

import { useMemo } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { StoredFile } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

/** Employee-facing view of their own uploaded documents (private → signed URL). */
export function EmployeeDocuments({ documents }: { documents: StoredFile[] }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  async function view(path: string) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.employeeDocuments)
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: "Couldn't open document", variant: "error" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
      <h2 className="mb-1 text-sm font-bold text-dark-base">My documents</h2>
      <p className="mb-4 text-xs text-gray-400">
        Documents you uploaded during onboarding.
      </p>
      {documents.length === 0 ? (
        <p className="text-sm text-gray-400">No documents on file.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
            >
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-dark-base">
                  {d.category ?? "Document"}
                </p>
                <p className="truncate text-xs text-gray-400">{d.filename}</p>
              </div>
              <button
                onClick={() => view(d.url)}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-cool-blue hover:underline"
              >
                View <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
