"use client";

/**
 * Dev-only visual showcase of the whole component library. Not linked in nav.
 * Visit /design-system to review every primitive + variant in one shot.
 */

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  Mail,
  Trash2,
  Plus,
  PartyPopper,
  CalendarX,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Avatar,
  Input,
  Textarea,
  Select,
  DatePicker,
  Modal,
  EmptyState,
  SkeletonCard,
  SkeletonRow,
  SkeletonText,
  useToast,
  Sidebar,
} from "@/components/ui";
import type { UserRole } from "@/lib/constants";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-dark-base">{title}</h2>
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
        {children}
      </div>
    </section>
  );
}

export default function DesignSystemPage() {
  // Dev-only component gallery — never reachable in production.
  if (process.env.NODE_ENV === "production") notFound();

  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [celebrateOpen, setCelebrateOpen] = useState(false);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [role, setRole] = useState<UserRole>("employee");

  const fireCelebration = () => {
    setCelebrateOpen(true);
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#7516EA", "#2E94F3", "#22C55E"],
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-dark-base px-6 py-8 text-white">
        <p className="text-sm font-medium text-white/50">ESG Astraa · Phase 1</p>
        <h1 className="mt-1 text-3xl font-extrabold">
          <span className="text-gradient-primary">Design System</span>
        </h1>
        <p className="mt-2 max-w-lg text-white/60">
          Every shared component and variant, styled with the brand tokens.
          Review here before feature screens are built on top.
        </p>
      </div>

      <div className="mx-auto max-w-5xl space-y-10 p-6">
        {/* Colors */}
        <Section title="Brand Tokens" description="Colors and the primary gradient.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { name: "dark-base", cls: "bg-dark-base", hex: "#232234" },
              {
                name: "electric-violet",
                cls: "bg-electric-violet",
                hex: "#7516EA",
              },
              { name: "cool-blue", cls: "bg-cool-blue", hex: "#2E94F3" },
              { name: "success", cls: "bg-success", hex: "#22C55E" },
              {
                name: "gradient",
                cls: "bg-gradient-primary",
                hex: "violet→blue",
              },
            ].map((c) => (
              <div key={c.name}>
                <div
                  className={`h-16 rounded-xl ${c.cls} shadow-soft`}
                  aria-hidden
                />
                <p className="mt-2 text-xs font-semibold text-dark-base">
                  {c.name}
                </p>
                <p className="text-xs text-gray-400">{c.hex}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Buttons */}
        <Section
          title="Buttons"
          description="Primary (gradient), secondary, destructive, ghost — plus sizes, icons, loading."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive" leftIcon={<Trash2 className="h-4 w-4" />}>
                Delete
              </Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button leftIcon={<Plus className="h-4 w-4" />}>With icon</Button>
              <Button
                loading={loadingBtn}
                onClick={() => {
                  setLoadingBtn(true);
                  setTimeout(() => setLoadingBtn(false), 1500);
                }}
              >
                Click to load
              </Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </Section>

        {/* Cards */}
        <Section title="Cards" description="Composable surface for tiles and rows.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s Attendance</CardTitle>
                <CardDescription>Checked in at 09:42 AM</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  You are 12m from the office — within the geofence.
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Check out</Button>
                <Button size="sm" variant="ghost">
                  View history
                </Button>
              </CardFooter>
            </Card>
            <Card className="flex flex-col items-start justify-center p-6">
              <Badge variant="present" dot>
                Present
              </Badge>
              <p className="mt-3 text-3xl font-extrabold text-dark-base">
                18<span className="text-lg text-gray-400">/20</span>
              </p>
              <p className="text-sm text-gray-500">Present this month</p>
            </Card>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges" description="Status pills.">
          <div className="flex flex-wrap gap-2">
            <Badge variant="present" dot>
              Present
            </Badge>
            <Badge variant="late" dot>
              Late
            </Badge>
            <Badge variant="absent" dot>
              Absent
            </Badge>
            <Badge variant="submitted">Submitted</Badge>
            <Badge variant="pending">Pending</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="neutral">Neutral</Badge>
          </div>
        </Section>

        {/* Avatars */}
        <Section title="Avatars" description="Initials fallback + gradient.">
          <div className="flex items-center gap-4">
            <Avatar name="Sameer Koyate" size="sm" />
            <Avatar name="Omkar Patil" size="md" />
            <Avatar name="ESG Astraa" size="lg" />
            <Avatar name="No Name" src="https://invalid.example/x.png" />
          </div>
        </Section>

        {/* Form primitives */}
        <Section
          title="Form Primitives"
          description="Wired for react-hook-form via forwardRef. Includes label, hint, and error states."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Full name"
              placeholder="Jane Doe"
              required
              hint="As per your ID"
            />
            <Input
              label="Work email"
              placeholder="you@esgastraa.com"
              leftIcon={<Mail className="h-4 w-4" />}
            />
            <Input
              label="Phone"
              placeholder="+91 ..."
              error="Enter a valid phone number"
            />
            <Select
              label="Department"
              placeholder="Select a department"
              options={[
                { label: "Consulting", value: "consulting" },
                { label: "Research", value: "research" },
                { label: "Operations", value: "operations" },
              ]}
            />
            <DatePicker label="Joining date" required />
            <Input
              label="Employee ID"
              value="ESGA-0001"
              disabled
              readOnly
            />
            <Textarea
              label="Today's task"
              placeholder="What did you work on?"
              className="sm:col-span-2"
              hint="Be specific — this is visible to admin"
            />
          </div>
        </Section>

        {/* Modals + Toasts */}
        <Section
          title="Modals & Toasts"
          description="Dialog, confirmation, celebratory popup, and notifications."
        >
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Open dialog
            </Button>
            <Button
              leftIcon={<PartyPopper className="h-4 w-4" />}
              onClick={fireCelebration}
            >
              Celebratory popup
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  title: "Attendance marked",
                  description: "Checked in at 09:42 AM.",
                  variant: "success",
                })
              }
            >
              Success toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  title: "Out of range",
                  description: "You're 340m from the office.",
                  variant: "error",
                })
              }
            >
              Error toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  title: "Heads up",
                  description: "Proof of work unlocks in 3h 20m.",
                  variant: "info",
                })
              }
            >
              Info toast
            </Button>
          </div>
        </Section>

        {/* Empty + Loading */}
        <Section
          title="Empty & Loading States"
          description="Every data screen gets one of each."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <EmptyState
              icon={CalendarX}
              title="No attendance yet"
              message="Once you check in, your records will show up here."
              action={<Button size="sm">Mark attendance</Button>}
            />
            <div className="space-y-4">
              <SkeletonCard />
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
              <SkeletonText lines={3} />
            </div>
          </div>
        </Section>

        {/* App shell */}
        <Section
          title="App Shell"
          description="Role-aware sidebar (dark-base). The full <AppShell> wraps real pages with this sidebar + a responsive top bar and mobile drawer."
        >
          <div className="mb-4 flex gap-2">
            <Button
              size="sm"
              variant={role === "employee" ? "primary" : "secondary"}
              onClick={() => setRole("employee")}
            >
              Employee nav
            </Button>
            <Button
              size="sm"
              variant={role === "admin" ? "primary" : "secondary"}
              onClick={() => setRole("admin")}
            >
              Admin nav
            </Button>
          </div>
          <div className="h-[480px] overflow-hidden rounded-2xl border border-gray-100">
            <Sidebar
              role={role}
              user={{
                name: "Sameer Koyate",
                email: "sameer@esgastraa.com",
              }}
              className="h-full"
            />
          </div>
        </Section>
      </div>

      {/* Dialog */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Delete this record?"
        description="This action can't be undone. The attendance entry will be permanently removed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setModalOpen(false);
                toast({ title: "Record deleted", variant: "success" });
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Confirmation dialogs use the same <code>Modal</code> primitive as the
          celebratory popup, just with different content.
        </p>
      </Modal>

      {/* Celebration */}
      <Modal
        open={celebrateOpen}
        onClose={() => setCelebrateOpen(false)}
        size="sm"
        hideClose
      >
        <div className="flex flex-col items-center py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <PartyPopper className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-dark-base">
            🎉 Great job — task completed on time!
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Another day, another win logged. See you tomorrow.
          </p>
          <Button
            className="mt-5"
            fullWidth
            onClick={() => setCelebrateOpen(false)}
          >
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}
