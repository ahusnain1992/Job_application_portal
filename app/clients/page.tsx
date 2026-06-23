import Link from "next/link";
import { Role } from "@prisma/client";
import { AppShell } from "@/components/shell";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { AddClientForm } from "@/components/add-client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ClientsPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireRole(Role.ADMIN);

  const [clients, teamMembers] = await Promise.all([
    prisma.clientProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assignments: { include: { user: { select: { name: true } } } },
        _count: { select: { jobs: true, applications: true } }
      }
    }),
    prisma.user.findMany({ where: { role: "TEAM_MEMBER", active: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <AppShell>
      <PageHeader title="Client profiles" eyebrow="Admin" />

      {searchParams.error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Something went wrong. Please try again.
        </div>
      ) : null}

      {/* Clients list — shown first so daily workflow starts here */}
      <div className="space-y-6 mb-8">
        {/* Active clients */}
        <Panel title={`${clients.filter(c => c.status === "ACTIVE").length} active clients`}>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {clients.filter(c => c.status === "ACTIVE").length === 0 ? (
              <div className="col-span-3 py-8 text-center text-sm text-muted">No active clients yet. Use &ldquo;Add client&rdquo; below to create the first one.</div>
            ) : clients.filter(c => c.status === "ACTIVE").map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`} className="rounded-lg border border-line p-4 hover:bg-canvas transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{client.clientName}</div>
                    <div className="mt-0.5 text-sm text-muted">{client.currentJobTitle}</div>
                  </div>
                  <Badge tone="brand">Active</Badge>
                </div>
                <div className="mt-2 text-sm text-muted line-clamp-1">{client.targetJobTitles.join(" · ")}</div>
                <div className="mt-3 flex items-center gap-4 text-sm text-muted">
                  <span>{client._count.jobs} jobs</span>
                  <span>{client._count.applications} applications</span>
                </div>
                <div className="mt-2 text-xs text-muted">
                  Assigned: {client.assignments.map((a) => a.user.name).join(", ") || "None"}
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        {/* Archived clients */}
        {clients.filter(c => c.status === "INACTIVE").length > 0 && (
          <Panel title={`${clients.filter(c => c.status === "INACTIVE").length} archived clients`}>
            <p className="mb-3 text-xs text-muted">Archived clients are hidden from the job queue. You can reactivate them or delete them permanently.</p>
            <div className="space-y-2">
              {clients.filter(c => c.status === "INACTIVE").map((client) => (
                <div key={client.id} className="flex items-center justify-between rounded-lg border border-line bg-canvas p-3">
                  <div className="min-w-0">
                    <Link href={`/clients/${client.id}`} className="font-semibold text-ink hover:text-brand hover:underline text-sm">
                      {client.clientName}
                    </Link>
                    <div className="text-xs text-muted">{client.currentJobTitle} · {client._count.jobs} jobs · {client._count.applications} applications</div>
                  </div>
                  <DeleteClientButton clientId={client.id} clientName={client.clientName} />
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {/* Add client form — collapsed by default */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-dashed border-brand/40 bg-[#F0FAF7] px-4 py-3 text-sm font-semibold text-[#186A5E] hover:bg-[#DFF5ED]">
          <span className="text-lg leading-none">+</span>
          Add new client
          <span className="ml-auto text-xs font-normal text-muted group-open:hidden">click to expand</span>
          <span className="ml-auto text-xs font-normal text-muted hidden group-open:inline">click to collapse</span>
        </summary>
        <div className="mt-4 max-w-2xl">
          <Panel title="New client profile">
            <AddClientForm teamMembers={teamMembers} />
          </Panel>
        </div>
      </details>
    </AppShell>
  );
}
