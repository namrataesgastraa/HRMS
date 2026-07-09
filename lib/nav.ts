import {
  LayoutDashboard,
  MapPin,
  ListTodo,
  MessagesSquare,
  Users,
  CalendarCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "./constants";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const employeeNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/attendance", icon: MapPin },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Chat", href: "/chat", icon: MessagesSquare },
];

const managerNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Team", href: "/team", icon: UsersRound },
  { label: "Attendance", href: "/attendance", icon: MapPin },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Chat", href: "/chat", icon: MessagesSquare },
];

const adminNav: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Employees", href: "/admin/employees", icon: Users },
  { label: "Attendance", href: "/admin/attendance", icon: CalendarCheck },
  { label: "Tasks", href: "/admin/tasks", icon: ListTodo },
  { label: "Chat", href: "/admin/chat", icon: MessagesSquare },
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
