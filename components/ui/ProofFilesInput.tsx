"use client";

import { useState } from "react";
import { Upload, FileText, X, Link as LinkIcon, Plus } from "lucide-react";

export interface ProofDraft {
  files: File[];
  links: string[];
}

export const emptyProof: ProofDraft = { files: [], links: [] };

/** File + camera + link proof-of-work input. Parent uploads files on submit. */
export function ProofFilesInput({
  value,
  onChange,
  label = "Proof of work",
  required = false,
}: {
  value: ProofDraft;
  onChange: (d: ProofDraft) => void;
  label?: string;
  required?: boolean;
}) {
  const [link, setLink] = useState("");

  const addFiles = (fl: FileList | null) => {
    if (fl?.length) onChange({ ...value, files: [...value.files, ...Array.from(fl)] });
  };
  const addLink = () => {
    const l = link.trim();
    if (!l) return;
    const withScheme = /^https?:\/\//i.test(l) ? l : `https://${l}`;
    onChange({ ...value, links: [...value.links, withScheme] });
    setLink("");
  };

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-dark-base">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </p>

      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer">
          <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-dark-base hover:bg-gray-50">
            <Upload className="h-4 w-4" /> Add files
          </span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
        <label className="cursor-pointer">
          <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-dark-base hover:bg-gray-50">
            <FileText className="h-4 w-4" /> Camera
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
      </div>

      {/* Link input */}
      <div className="mt-2 flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            placeholder="Paste a link (Drive, Docs, URL…)"
            className="h-10 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
          />
        </div>
        <button
          type="button"
          onClick={addLink}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-dark-base hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" /> Link
        </button>
      </div>

      {/* Pending list */}
      {(value.files.length > 0 || value.links.length > 0) && (
        <ul className="mt-3 space-y-2">
          {value.files.map((f, i) => (
            <li
              key={`f-${f.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="flex-1 truncate">{f.name}</span>
              <button
                type="button"
                aria-label="Remove"
                onClick={() =>
                  onChange({ ...value, files: value.files.filter((_, j) => j !== i) })
                }
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
          {value.links.map((l, i) => (
            <li
              key={`l-${i}`}
              className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
            >
              <LinkIcon className="h-4 w-4 text-cool-blue" />
              <span className="flex-1 truncate text-cool-blue">{l}</span>
              <button
                type="button"
                aria-label="Remove"
                onClick={() =>
                  onChange({ ...value, links: value.links.filter((_, j) => j !== i) })
                }
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
