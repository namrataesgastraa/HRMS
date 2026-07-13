import {
  LayoutDashboard,
  MapPin,
  ListTodo,
  MessagesSquare,
  Users,
  CalendarCheck,
  UsersRound,
  Gauge,
  Video,
  CalendarDays,
  Mail,
  MonitorPlay,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "./constants";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** External productivity apps opened in a new tab from the sidebar. */
export const EXTERNAL_APPS: NavItem[] = [
  { label: "Outlook", href: "https://outlook.office.com/mail/", icon: Mail },
  { label: "Microsoft Teams", href: "https://teams.microsoft.com/", icon: MonitorPlay },
];

const employeeNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/attendance", icon: MapPin },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Leave", href: "/leave", icon: CalendarDays },
  { label: "Chat", href: "/chat", icon: MessagesSquare },
  { label: "Meetings", href: "/meetings", icon: Video },
];

const managerNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Team", href: "/team", icon: UsersRound },
  { label: "Attendance", href: "/attendance", icon: MapPin },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Leave", href: "/leave", icon: CalendarDays },
  { label: "Evaluation", href: "/evaluation", icon: Gauge },
  { label: "Chat", href: "/chat", icon: MessagesSquare },
  { label: "Meetings", href: "/meetings", icon: Video },
];

const adminNav: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Employees", href: "/admin/employees", icon: Users },
  { label: "Attendance", href: "/admin/attendance", icon: CalendarCheck },
  { label: "Tasks", href: "/admin/tasks", icon: ListTodo },
  { label: "Leave", href: "/admin/leave", icon: CalendarDays },
  { label: "Evaluation", href: "/admin/evaluation", icon: Gauge },
  { label: "Chat", href: "/admin/chat", icon: MessagesSquare },
  { label: "Meetings", href: "/admin/meetings", icon: Video },
];

export function navForRole(role: UserRole): NavItem[] {
  if (role === "admin") return adminNav;
  if (role === "manager") return managerNav;
  return employeeNav;
}

/** Page title derived from the current path (for the shared top bar). */
export function titleForPath(pathname: string): string {
  if (pathname.startsWith("/profile")) return "My Profile";
  if (pathname.startsWith("/team/")) return "Team member";
  if (pathname.startsWith("/admin/employees/") && pathname !== "/admin/employees")
    return "Employee";
  const all = [...managerNav, ...adminNav];
  const match = all
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "ESG Astraa";
}
