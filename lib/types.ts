import type { UserRole, AttendanceStatus } from "./constants";

/** Row shape of public.profiles. */
export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  employee_id: string | null;
  profile_completed: boolean;
  can_chat: boolean;
  avatar_url: string | null;
  department: string | null;
  created_at: string;
}

export interface Milestone30 {
  title: string;
  detail: string;
}

export interface ThirtyDayPlan {
  id: string;
  profile_id: string;
  plan_number: number; // 1 | 2 | 3
  content: { outline?: Milestone30[]; file?: StoredFile } | null;
  created_at: string;
}

/** One task entry (a day can hold many). Replaces the old single daily log. */
export interface TaskEntry {
  id: string;
  profile_id: string;
  thirty_day_plan_id: string | null;
  day_number: number; // global 1..90
  task_title: string;
  description: string | null;
  proof_files: StoredFile[] | null;
  attendance_id: string | null;
  is_late: boolean;
  submitted_at: string | null;
  created_at: string;
}

export interface Evaluation {
  id: string;
  evaluator_id: string;
  subject_id: string;
  eval_date: string; // yyyy-mm-dd
  score: number; // 0–100
  checked_task_ids: string[] | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationEvent {
  id: string;
  evaluator_id: string;
  subject_id: string;
  eval_date: string;
  score: number;
  checked_count: number | null;
  note: string | null;
  created_at: string;
}

export interface AssignedTask {
  id: string;
  admin_id: string;
  profile_id: string;
  title: string;
  message: string | null;
  assigned_for: string | null;
  deadline: string | null;
  status: "pending" | "done";
  proof_files: StoredFile[] | null;
  attachments: StoredFile[] | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  profile_id: string;
  edited_by: string | null;
  summary: string | null;
  changes: unknown;
  created_at: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
}

export interface StoredFile {
  /** Storage path/key within the bucket (resolve via signed URL to view). */
  url: string;
  type: string;
  filename: string;
  /** e.g. "photo" | "id-document" for onboarding uploads. */
  category?: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

export interface Milestone {
  week: string;
  goal: string;
}

export interface TaskPlan {
  id: string;
  profile_id: string;
  plan_content: { milestones?: Milestone[]; file?: StoredFile } | null;
  submitted_at: string;
}

export interface DailyTaskLog {
  id: string;
  profile_id: string;
  attendance_id: string | null;
  task_description: string | null;
  proof_files: StoredFile[] | null;
  submitted_at: string | null;
  is_late: boolean;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  profile_id: string;
  office_id: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  distance_meters: number | null;
  is_mock_location: boolean;
  status: AttendanceStatus;
  created_at: string;
}
