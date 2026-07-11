"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  parseISO,
  isSameMonth,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";

export interface CalEntry {
  start: string;
  end: string;
  status: string;
  name: string;
}

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function LeaveCalendar({
  year,
  month,
  entries,
}: {
  year: number;
  month: number;
  entries: CalEntry[];
}) {
  const first = new Date(year, month, 1);
  const gridStart = startOfWeek(startOfMonth(first));
  const gridEnd = endOfWeek(endOfMonth(first));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const entriesFor = (d: Date) => {
    const day = dayOnly(d);
    return entries.filter((e) => {
      try {
        const s = dayOnly(parseISO(e.start));
        const en = dayOnly(parseISO(e.end));
        return day >= s && day <= en && e.status !== "rejected";
      } catch {
        return false;
      }
    });
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-400">
        {WEEK.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, first);
          const list = entriesFor(d);
          return (
            <div
              key={i}
              className={cn(
                "min-h-[68px] rounded-lg border p-1",
                inMonth ? "border-gray-100" : "border-transparent bg-gray-50/40",
                isToday(d) && "ring-1 ring-electric-violet",
              )}
            >
              <div
                className={cn(
                  "mb-0.5 text-right text-[11px]",
                  inMonth ? "text-gray-500" : "text-gray-300",
                )}
              >
                {format(d, "d")}
              </div>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((e, j) => (
                  <div
                    key={j}
                    title={`${e.name} · ${e.status}`}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                      e.status === "approved"
                        ? "bg-success/15 text-success"
                        : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {e.name}
                  </div>
                ))}
                {list.length > 3 && (
                  <div className="px-1 text-[10px] text-gray-400">
                    +{list.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-success" /> Approved
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Pending
        </span>
      </div>
    </div>
  );
}
