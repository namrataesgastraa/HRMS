"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Plus, Trash2, FileText, ExternalLink, Upload } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { uploadAvatar, uploadUserFiles } from "@/lib/storage";
import { logProfileEdit, diffRecords } from "@/lib/audit";
import {
  DEPARTMENT_OPTIONS,
  DEPARTMENTS,
  OTHER_DEPARTMENT,
  ageFromDob,
} from "@/lib/validation/onboarding";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { StoredFile, EducationEntry } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

export interface ProfileInitial {
  full_name: string;
  avatar_url: string | null;
  dob: string; // yyyy-mm-dd or ""
  phone: string;
  personal_email: string;
  address: string;
  emergency_contact: string;
  designation: string;
  department: string;
  joining_date: string; // yyyy-mm-dd or ""
  reporting_manager: string;
  education: EducationEntry[];
  documents: StoredFile[];
}

const DOC_CATEGORIES = [
  "Aadhaar",
  "PAN",
  "Resume / CV",
  "Educational certificate",
  "Mark sheet",
  "Relieving letter",
  "Bank details",
  "Passport photo",
  "Address proof",
  "Other",
];

export function ProfileEditForm({
  uid,
  initial,
}: {
  uid: string;
  initial: ProfileInitial;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState<ProfileInitial>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [docCategory, setDocCategory] = useState("Other");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const knownDepts = DEPARTMENTS as readonly string[];
  const [deptChoice, setDeptChoice] = useState(
    !initial.department
      ? ""
      : knownDepts.includes(initial.department)
        ? initial.department
        : OTHER_DEPARTMENT,
  );
  const [deptOther, setDeptOther] = useState(
    initial.department && !knownDepts.includes(initial.department)
      ? initial.department
      : "",
  );

  const preview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : initial.avatar_url),
    [photo, initial.avatar_url],
  );

  function set<K extends keyof ProfileInitial>(key: K, value: ProfileInitial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ---- Education ----
  function addEducation() {
    set("education", [...form.education, { degree: "", institution: "", year: "" }]);
  }
  function setEducation(i: number, key: keyof EducationEntry, value: string) {
    set(
      "education",
      form.education.map((e, j) => (j === i ? { ...e, [key]: value } : e)),
    );
  }
  function removeEducation(i: number) {
    set("education", form.education.filter((_, j) => j !== i));
  }

  // ---- Documents ----
  async function addDocument(file: File | null) {
    if (!file) return;
    setUploadingDoc(true);
    try {
      const [stored] = await uploadUserFiles(
        supabase,
        STORAGE_BUCKETS.employeeDocuments,
        uid,
        [file],
        docCategory || "Document",
      );
      set("documents", [...form.documents, stored]);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setUploadingDoc(false);
    }
  }
  async function removeDocument(i: number) {
    const doc = form.documents[i];
    // Best-effort delete of the underlying file (reference removal is what counts).
    try {
      await supabase.storage.from(STORAGE_BUCKETS.employeeDocuments).remove([doc.url]);
    } catch {
      /* ignore */
    }
    set("documents", form.documents.filter((_, j) => j !== i));
  }
  async function viewDocument(path: string) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.employeeDocuments)
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: "Couldn't open document", variant: "error" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function save() {
    setSaving(true);
    try {
      let avatarUrl = initial.avatar_url;
      if (photo) avatarUrl = await uploadAvatar(supabase, uid, photo);

      const cleanEducation = form.education.filter((e) => e.degree || e.institution);

      const detailsAfter = {
        dob: form.dob || null,
        age: form.dob ? ageFromDob(form.dob) : null,
        phone: form.phone || null,
        personal_email: form.personal_email || null,
        address: form.address || null,
        emergency_contact: form.emergency_contact || null,
        designation: form.designation || null,
        department: form.department || null,
        joining_date: form.joining_date || null,
        reporting_manager: form.reporting_manager || null,
        education: cleanEducation,
        documents: form.documents,
      };
      const { error: dErr } = await supabase
        .from("employee_details")
        .update(detailsAfter)
        .eq("profile_id", uid);
      if (dErr) throw dErr;

      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          avatar_url: avatarUrl,
          department: form.department || null,
        })
        .eq("id", uid);
      if (pErr) throw pErr;

      // Audit log — scalars compared directly; arrays via a stable string.
      const eduStr = (e: EducationEntry[]) =>
        JSON.stringify(e.map((x) => `${x.degree}/${x.institution}/${x.year}`));
      const docStr = (d: StoredFile[]) =>
        JSON.stringify(d.map((x) => `${x.category ?? ""}:${x.filename}`));
      const changes = diffRecords(
        {
          full_name: initial.full_name,
          dob: initial.dob,
          phone: initial.phone,
          personal_email: initial.personal_email,
          address: initial.address,
          emergency_contact: initial.emergency_contact,
          designation: initial.designation,
          department: initial.department,
          joining_date: initial.joining_date,
          reporting_manager: initial.reporting_manager,
          education: eduStr(initial.education),
          documents: docStr(initial.documents),
          avatar_url: initial.avatar_url,
        },
        {
          full_name: form.full_name,
          dob: form.dob,
          phone: form.phone,
          personal_email: form.personal_email,
          address: form.address,
          emergency_contact: form.emergency_contact,
          designation: form.designation,
          department: form.department,
          joining_date: form.joining_date,
          reporting_manager: form.reporting_manager,
          education: eduStr(cleanEducation),
          documents: docStr(form.documents),
          avatar_url: avatarUrl,
        },
      );
      await logProfileEdit(supabase, uid, uid, changes);

      toast({ title: "Profile updated", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Photo */}
      <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
        <div className="relative">
          <Avatar name={form.full_name} src={preview} size="lg" />
          <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-electric-violet p-1.5 text-white shadow-soft">
            <Camera className="h-3.5 w-3.5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div>
          <p className="font-semibold text-dark-base">Profile photo</p>
          <p className="text-sm text-gray-500">
            Shown across attendance, tasks, chat and admin views.
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="grid gap-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:grid-cols-2">
        <Input
          label="Full name"
          value={form.full_name}
          onChange={(e) => set("full_name", e.target.value)}
        />
        <Input
          label="Date of birth"
          type="date"
          value={form.dob}
          onChange={(e) => set("dob", e.target.value)}
        />
        <Input
          label="Phone"
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value.replace(/[^\d+\s-]/g, ""))}
        />
        <Input
          label="Personal email"
          type="email"
          value={form.personal_email}
          onChange={(e) => set("personal_email", e.target.value)}
        />
        <Input
          label="Designation"
          value={form.designation}
          onChange={(e) => set("designation", e.target.value)}
        />
        <Select
          label="Department"
          value={deptChoice}
          onChange={(e) => {
            const v = e.target.value;
            setDeptChoice(v);
            set("department", v === OTHER_DEPARTMENT ? deptOther : v);
          }}
          placeholder="Select a department"
          options={DEPARTMENT_OPTIONS}
        />
        {deptChoice === OTHER_DEPARTMENT && (
          <Input
            label="Specify department"
            value={deptOther}
            onChange={(e) => {
              setDeptOther(e.target.value);
              set("department", e.target.value);
            }}
            placeholder="Your department"
          />
        )}
        <Input
          label="Joining date"
          type="date"
          value={form.joining_date}
          onChange={(e) => set("joining_date", e.target.value)}
        />
        <Input
          label="Reporting manager"
          value={form.reporting_manager}
          onChange={(e) => set("reporting_manager", e.target.value)}
        />
        <Input
          label="Emergency contact"
          value={form.emergency_contact}
          onChange={(e) => set("emergency_contact", e.target.value)}
        />
        <Textarea
          label="Address"
          className="sm:col-span-2"
          rows={3}
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </div>

      {/* Education */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-dark-base">Education</h2>
          <Button size="sm" variant="secondary" onClick={addEducation} leftIcon={<Plus className="h-4 w-4" />}>
            Add
          </Button>
        </div>
        {form.education.length === 0 ? (
          <p className="text-sm text-gray-400">No education added.</p>
        ) : (
          <div className="space-y-3">
            {form.education.map((e, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto]">
                <Input
                  placeholder="Degree"
                  value={e.degree}
                  onChange={(ev) => setEducation(i, "degree", ev.target.value)}
                />
                <Input
                  placeholder="Institution"
                  value={e.institution}
                  onChange={(ev) => setEducation(i, "institution", ev.target.value)}
                />
                <Input
                  placeholder="Year"
                  inputMode="numeric"
                  value={e.year}
                  onChange={(ev) =>
                    setEducation(i, "year", ev.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                />
                <button
                  onClick={() => removeEducation(i)}
                  className="flex items-center justify-center rounded-lg px-2 text-red-500 hover:bg-red-50"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
        <h2 className="mb-1 text-sm font-bold text-dark-base">My documents</h2>
        <p className="mb-4 text-xs text-gray-400">
          Upload, replace or remove your documents. Changes are logged for HR.
        </p>

        {form.documents.length > 0 && (
          <ul className="mb-4 space-y-2">
            {form.documents.map((d, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-dark-base">
                    {d.category ?? "Document"}
                  </p>
                  <p className="truncate text-xs text-gray-400">{d.filename}</p>
                </div>
                <button
                  onClick={() => viewDocument(d.url)}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-cool-blue hover:underline"
                >
                  View <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => removeDocument(i)}
                  className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  aria-label="Remove document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full sm:w-56">
            <Select
              label="Document type"
              value={docCategory}
              onChange={(e) => setDocCategory(e.target.value)}
              options={DOC_CATEGORIES.map((c) => ({ label: c, value: c }))}
            />
          </div>
          <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-dark-base transition-colors hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            {uploadingDoc ? "Uploading…" : "Upload document"}
            <input
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              disabled={uploadingDoc}
              onChange={(e) => {
                addDocument(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
