import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, ClipboardList, FileText, LayoutDashboard, LogOut, UserCog, Users, ListChecks, BookOpen } from "lucide-react";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { roleLabel } from "@/lib/format";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/reports", label: "Reports", icon: BookOpen },
  { href: "/resumes/strategy", label: "Resume Strategy", icon: FileText },
  { href: "/settings", label: "Settings & Users", icon: UserCog }
];

const teamLinks = [
  { href: "/team", label: "Dashboard", icon: LayoutDashboard },
  { href: "/queue", label: "My Queue", icon: ListChecks },
  { href: "/jobs", label: "All Jobs", icon: BriefcaseBusiness },
  { href: "/applications", label: "My Applications", icon: ClipboardList },
  { href: "/resumes", label: "Resumes", icon: FileText }
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const links = user.role === Role.ADMIN ? adminLinks : teamLinks;

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white px-4 py-5 lg:block">
        <Link href={user.role === Role.ADMIN ? "/admin" : "/team"} className="block">
          <div className="text-sm font-semibold uppercase tracking-wide text-brand">Operations Portal</div>
          <div className="mt-1 text-lg font-semibold text-ink">Job Applications</div>
        </Link>
        <nav className="mt-8 space-y-1">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-canvas focus-ring">
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <div className="text-sm font-medium text-muted">{roleLabel(user.role)}</div>
              <div className="text-base font-semibold text-ink">{user.name}</div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-canvas" title="Sign out">
                <LogOut size={17} />
                Sign out
              </button>
            </form>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 lg:hidden">
            {links.map((item) => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-canvas">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
