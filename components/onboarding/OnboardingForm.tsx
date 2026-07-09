"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  Briefcase,
  GraduationCap,
  FileText,
  CheckCircle2,
  Plus,
  Trash2,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { uploadUserFiles, uploadAvatar } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/utils";
import {
  onboardingSchema,
  type OnboardingValues,
  STEP_FIELDS,
  DEPARTMENT_OPTIONS,
  ageFromDob,
} from "@/lib/validation/onboarding";

interface Props {
  uid: string;
  employeeId: string;
  initialFullName?: string;
  initialEmail?: string;
}

const STEPS = [
  { label: "Personal", icon: User },
  { label: "Employment", icon: Briefcase },
  { label: "Education", icon: GraduationCap },
  { label: "Documents", icon: FileText },
  { label: "Review", icon: CheckCircle2 },
];

// Documents an employee uploads during onboarding.
const DOC_CATEGORIES: { key: string; label: string; required: boolean }[] = [
  { key: "aadhaar", label: "Aadhaar Card", required: true },
  { key: "pan", label: "PAN Card", required: true },
  { key: "resume", label: "Updated Resume / CV", required: true },
  { key: "education", label: "Educational Certificates & Mark Sheets", required: true },
  { key: "relieving", label: "Relieving Letter (previous employer)", required: false },
  { key: "bank", label: "Bank Account Details", required: true },
  { key: "passport-photo", label: "Passport Size Photographs", required: true },
  { key: "address-proof", label: "Proof of Residential Address", required: true },
];

export function OnboardingForm({
  uid,
  employeeId,
  initialFullName,
  initialEmail,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const draftKey = `esga-onboarding-draft-${uid}`;

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [docFiles, setDocFiles] = useState<Record<string, File[]>>({});

  function addDocFiles(key: string, files: FileList | null) {
    if (!files?.length) return;
    setDocFiles((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), ...Array.from(files)],
    }));
  }
  function removeDocFile(key: string, index: number) {
    setDocFiles((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((_, j) => j !== index),
    }));
  }

  const defaultValues: OnboardingValues = useMemo(
    () => ({
      full_name: initialFullName ?? "",
      dob: "",
      phone: "",
      personal_email: initialEmail ?? "",
      address: "",
      emergency_contact: "",
      designation: "",
      department: "",
      joining_date: "",
      reporting_manager: "",
      education: [{ degree: "", institution: "", year: "" }],
    }),
    [initialFullName, initialEmail],
  );

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "education",
  });

  // Restore draft (text fields only — files can't be serialized).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) reset({ ...defaultValues, ...JSON.parse(raw) });
    } catch {
      /* ignore malformed draft */
    }
  }, [draftKey, defaultValues, reset]);

  // Autosave draft on any change.
  useEffect(() => {
    const sub = watch((values) => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(values));
      } catch {
        /* storage may be full/unavailable */
      }
    });
    return () => sub.unsubscribe();
  }, [watch, draftKey]);

  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  async function next() {
    const fieldsToCheck = STEP_FIELDS[step];
    const ok = fieldsToCheck.length
      ? await trigger(fieldsToCheck as (keyof OnboardingValues)[])
      : true;
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onFinalSubmit(values: OnboardingValues) {
    setSubmitting(true);
    try {
      // 1a. Profile photo → public avatars bucket (shown everywhere as avatar).
      const avatarUrl = photo ? await uploadAvatar(supabase, uid, photo) : null;

      // 1b. Categorised documents → private employee-documents bucket.
      const documents = [];
      for (const cat of DOC_CATEGORIES) {
        const files = docFiles[cat.key] ?? [];
        if (files.length) {
          const uploaded = await uploadUserFiles(
            supabase,
            STORAGE_BUCKETS.employeeDocuments,
            uid,
            files,
            cat.label,
          );
          documents.push(...uploaded);
        }
      }

      // 2. Upsert employee_details (one row per profile).
      const { error: detailsError } = await supabase
        .from("employee_details")
        .upsert(
          {
            profile_id: uid,
            age: ageFromDob(values.dob),
            phone: values.phone || null,
            personal_email: values.personal_email || null,
            address: values.address || null,
            emergency_contact: values.emergency_contact || null,
            designation: values.designation || null,
            department: values.department || null,
            joining_date: values.joining_date || null,
            reporting_manager: values.reporting_manager || null,
            education: (values.education ?? []).filter((e) => e.degree),
            documents,
          },
          { onConflict: "profile_id" },
        );
      if (detailsError) throw detailsError;

      // 3. Flip profile_completed + save name on profiles.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          profile_completed: true,
          department: values.department || null,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })
        .eq("id", uid);
      if (profileError) throw profileError;

      localStorage.removeItem(draftKey);
      toast({
        title: "Profile complete!",
        description: "Welcome to ESG Astraa.",
        variant: "success",
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      toast({
        title: "Couldn't save your profile",
        description:
          err instanceof Error ? err.message : "Please try again in a moment.",
        variant: "error",
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-500">
          {employeeId} · Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-dark-base">
          Complete your profile
        </h1>
      </div>

      <Stepper step={step} />

      <form
        onSubmit={handleSubmit(onFinalSubmit)}
        className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-card"
      >
        {/* Step 0 — Personal */}
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Full name"
              required
              className="sm:col-span-2"
              error={errors.full_name?.message}
              {...register("full_name")}
            />
            <DatePicker
              label="Date of birth"
              required
              error={errors.dob?.message}
              {...register("dob")}
            />
            <Input
              label="Phone"
              required
              placeholder="+91 ..."
              error={errors.phone?.message}
              {...register("phone")}
            />
            <Input
              label="Personal email"
              type="email"
              placeholder="you@example.com"
              error={errors.personal_email?.message}
              {...register("personal_email")}
            />
            <Input
              label="Emergency contact"
              placeholder="Name · phone"
              error={errors.emergency_contact?.message}
              {...register("emergency_contact")}
            />
            <Textarea
              label="Address"
              className="sm:col-span-2"
              rows={3}
              {...register("address")}
            />
          </div>
        )}

        {/* Step 1 — Employment */}
        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Employee ID"
              value={employeeId}
              disabled
              readOnly
              hint="Auto-generated"
            />
            <Input
              label="Designation"
              placeholder="e.g. ESG Analyst"
              {...register("designation")}
            />
            <Select
              label="Department"
              placeholder="Select a department"
              options={DEPARTMENT_OPTIONS}
              {...register("department")}
            />
            <DatePicker label="Joining date" {...register("joining_date")} />
            <Input
              label="Reporting manager"
              className="sm:col-span-2"
              placeholder="Manager's name"
              {...register("reporting_manager")}
            />
          </div>
        )}

        {/* Step 2 — Education */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Add each qualification. You can add multiple.
            </p>
            {fields.map((field, i) => (
              <div
                key={field.id}
                className="relative grid gap-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-3"
              >
                <Input
                  label="Degree"
                  placeholder="B.Tech"
                  error={errors.education?.[i]?.degree?.message}
                  {...register(`education.${i}.degree` as const)}
                />
                <Input
                  label="Institution"
                  placeholder="University"
                  error={errors.education?.[i]?.institution?.message}
                  {...register(`education.${i}.institution` as const)}
                />
                <Input
                  label="Year"
                  placeholder="2022"
                  inputMode="numeric"
                  error={errors.education?.[i]?.year?.message}
                  {...register(`education.${i}.year` as const)}
                />
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label="Remove qualification"
                    className="absolute right-2 top-2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() =>
                append({ degree: "", institution: "", year: "" })
              }
            >
              Add qualification
            </Button>
          </div>
        )}

        {/* Step 3 — Documents */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Photo */}
            <div>
              <p className="mb-2 text-sm font-semibold text-dark-base">
                Profile photo
              </p>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 text-gray-300">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-7 w-7" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-dark-base transition-colors hover:bg-gray-50">
                    <Upload className="h-4 w-4" />
                    {photo ? "Change photo" : "Upload photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            {/* Categorised documents */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-dark-base">
                Upload your documents
              </p>
              {DOC_CATEGORIES.map((cat) => {
                const files = docFiles[cat.key] ?? [];
                return (
                  <div
                    key={cat.key}
                    className="rounded-xl border border-gray-100 bg-gray-50/60 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-dark-base">
                        {cat.label}
                        {cat.required ? (
                          <span className="ml-1 text-red-500">*</span>
                        ) : (
                          <span className="ml-1 text-xs font-normal text-gray-400">
                            (if applicable)
                          </span>
                        )}
                      </p>
                      <label className="cursor-pointer">
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-dark-base hover:bg-gray-50">
                          <Upload className="h-3.5 w-3.5" />
                          Add
                        </span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          className="hidden"
                          onChange={(e) => addDocFiles(cat.key, e.target.files)}
                        />
                      </label>
                    </div>
                    {files.length > 0 && (
                      <ul className="space-y-1.5">
                        {files.map((f, i) => (
                          <li
                            key={`${f.name}-${i}`}
                            className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-sm"
                          >
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span className="flex-1 truncate">{f.name}</span>
                            <button
                              type="button"
                              aria-label="Remove file"
                              onClick={() => removeDocFile(cat.key, i)}
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
              })}
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <ReviewStep values={getValues()} photo={photo} docFiles={docFiles} />
        )}

        {/* Nav buttons */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={back}
            disabled={step === 0 || submitting}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button type="submit" loading={submitting}>
              Save &amp; finish
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/* --- Stepper --------------------------------------------------------------- */
function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={s.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  active && "bg-gradient-primary text-white shadow-soft",
                  done && "bg-electric-violet/10 text-electric-violet",
                  !active && !done && "bg-gray-100 text-gray-400",
                )}
              >
                {done ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "mt-1.5 hidden text-xs font-medium sm:block",
                  active ? "text-dark-base" : "text-gray-400",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                  i < step ? "bg-electric-violet" : "bg-gray-100",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --- Review ---------------------------------------------------------------- */
function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-dark-base">
        {value || "—"}
      </span>
    </div>
  );
}

function ReviewStep({
  values,
  photo,
  docFiles,
}: {
  values: OnboardingValues;
  photo: File | null;
  docFiles: Record<string, File[]>;
}) {
  const age = ageFromDob(values.dob);
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        Review your details, then save. You can update these later from your
        profile.
      </p>
      <section>
        <h3 className="mb-1 text-sm font-bold text-dark-base">Personal</h3>
        <div className="divide-y divide-gray-50">
          <Row label="Full name" value={values.full_name} />
          <Row
            label="Date of birth"
            value={values.dob ? `${values.dob}${age != null ? ` · ${age} yrs` : ""}` : ""}
          />
          <Row label="Phone" value={values.phone} />
          <Row label="Personal email" value={values.personal_email} />
          <Row label="Emergency contact" value={values.emergency_contact} />
          <Row label="Address" value={values.address} />
        </div>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-bold text-dark-base">Employment</h3>
        <div className="divide-y divide-gray-50">
          <Row label="Designation" value={values.designation} />
          <Row label="Department" value={values.department} />
          <Row label="Joining date" value={values.joining_date} />
          <Row label="Reporting manager" value={values.reporting_manager} />
        </div>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-bold text-dark-base">Education</h3>
        {(values.education ?? []).filter((e) => e.degree).length ? (
          <ul className="space-y-1 text-sm">
            {(values.education ?? [])
              .filter((e) => e.degree)
              .map((e, i) => (
                <li key={i} className="text-dark-base">
                  {e.degree}, {e.institution}{" "}
                  <span className="text-gray-400">({e.year})</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">None added</p>
        )}
      </section>
      <section>
        <h3 className="mb-1 text-sm font-bold text-dark-base">Documents</h3>
        <p className="text-sm text-dark-base">
          Profile photo: {photo ? photo.name : "—"}
        </p>
        <ul className="mt-1 space-y-0.5 text-sm">
          {DOC_CATEGORIES.map((cat) => {
            const n = (docFiles[cat.key] ?? []).length;
            return (
              <li key={cat.key} className="flex justify-between">
                <span className="text-gray-500">{cat.label}</span>
                <span className="font-medium text-dark-base">
                  {n ? `${n} file(s)` : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
