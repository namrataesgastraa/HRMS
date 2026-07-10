"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { uploadAvatar } from "@/lib/storage";
import { logProfileEdit, diffRecords } from "@/lib/audit";
import {
  DEPARTMENT_OPTIONS,
  DEPARTMENTS,
  OTHER_DEPARTMENT,
} from "@/lib/validation/onboarding";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

interface Initial {
  full_name: string;
  avatar_url: string | null;
  phone: string;
  personal_email: string;
  address: string;
  emergency_contact: string;
  designation: string;
  department: string;
  reporting_manager: string;
}

export function ProfileEditForm({
  uid,
  initial,
}: {
  uid: string;
  initial: Initial;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState<Initial>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Map an existing (possibly custom) department onto the fixed options.
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

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      let avatarUrl = initial.avatar_url;
      if (photo) avatarUrl = await uploadAvatar(supabase, uid, photo);

      // employee_details update
      const detailsAfter = {
        phone: form.phone || null,
        personal_email: form.personal_email || null,
        address: form.address || null,
        emergency_contact: form.emergency_contact || null,
        designation: form.designation || null,
        department: form.department || null,
        reporting_manager: form.reporting_manager || null,
      };
      const { error: dErr } = await supabase
        .from("employee_details")
        .update(detailsAfter)
        .eq("profile_id", uid);
      if (dErr) throw dErr;

      // profiles update (name + avatar + department mirror)
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          avatar_url: avatarUrl,
          department: form.department || null,
        })
        .eq("id", uid);
      if (pErr) throw pErr;

      // Audit log
      const changes = diffRecords(
        {
          full_name: initial.full_name,
          phone: initial.phone,
          personal_email: initial.personal_email,
          address: initial.address,
          emergency_contact: initial.emergency_contact,
          designation: initial.designation,
          department: initial.department,
          reporting_manager: initial.reporting_manager,
          avatar_url: initial.avatar_url,
        },
        {
          full_name: form.full_name,
          phone: form.phone,
          personal_email: form.personal_email,
          address: form.address,
          emergency_contact: form.emergency_contact,
          designation: form.designation,
          department: form.department,
          reporting_manager: form.reporting_manager,
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
          label="Phone"
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={(e) =>
            set("phone", e.target.value.replace(/[^\d+\s-]/g, ""))
          }
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

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
