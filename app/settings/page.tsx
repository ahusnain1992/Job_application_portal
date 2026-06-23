import { Role } from "@prisma/client";
import { AppShell } from "@/components/shell";
import { Badge, PageHeader, Panel, Select, SubmitButton, TextArea, TextInput } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderManifest } from "@/lib/job-providers/registry";

export default async function SettingsPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireRole(Role.ADMIN);
  const providerManifest = getProviderManifest();
  const [sources, teamMembers, dailyTargets] = await Promise.all([
    prisma.jobSource.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ where: { role: Role.TEAM_MEMBER }, orderBy: { name: "asc" } }),
    prisma.dailyTarget.findMany({ select: { userId: true, target: true } })
  ]);
  const targetByUser = Object.fromEntries(dailyTargets.map((t) => [t.userId, t.target]));

  const errorMessages: Record<string, string> = {
    "missing-fields": "Name, email, and password are all required.",
    "email-taken": "A user with that email already exists.",
    "self-deactivate": "You cannot deactivate your own account.",
    "invalid-user": "That user action could not be completed."
  };

  return (
    <AppShell>
      <PageHeader title="Settings" eyebrow="Admin" />
      {searchParams.error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessages[searchParams.error] || "Something went wrong."}
        </div>
      ) : null}

      <h2 className="mb-4 text-lg font-semibold text-ink">Team members</h2>
      <div className="mb-8 grid gap-6 xl:grid-cols-[380px_1fr]">
        <Panel title="Add team member">
          <form action="/api/users" method="post" className="space-y-3">
            <TextInput name="name" placeholder="Full name" required />
            <TextInput name="email" type="email" placeholder="Email address" required />
            <TextInput name="password" type="password" placeholder="Temporary password" required />
            <input type="hidden" name="action" value="create" />
            <SubmitButton>Create account</SubmitButton>
          </form>
        </Panel>
        <Panel title="Team member accounts">
          <div className="space-y-3">
            {teamMembers.length === 0 ? (
              <div className="text-sm text-muted">No team members yet.</div>
            ) : teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0">
                <div>
                  <div className="font-medium text-ink">{member.name}</div>
                  <div className="text-sm text-muted">{member.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <form action="/api/users/daily-target" method="post" className="flex items-center gap-1.5">
                    <input type="hidden" name="userId" value={member.id} />
                    <label className="text-xs text-muted">Target/day</label>
                    <input
                      type="number"
                      name="target"
                      min={1}
                      max={100}
                      defaultValue={targetByUser[member.id] ?? 30}
                      className="h-7 w-16 rounded border border-line px-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    <button className="h-7 rounded bg-brand px-2 text-xs font-semibold text-white hover:bg-brand/90">Set</button>
                  </form>
                  <Badge tone={member.active ? "brand" : "neutral"}>{member.active ? "Active" : "Inactive"}</Badge>
                  <form action="/api/users" method="post">
                    <input type="hidden" name="userId" value={member.id} />
                    <input type="hidden" name="action" value={member.active ? "deactivate" : "reactivate"} />
                    <button className="text-xs text-muted underline hover:text-ink">
                      {member.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-ink">Job provider status</h2>
      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Provider selection is controlled by Railway environment variables, not this table. Records here are created automatically when jobs are fetched.
      </div>
      <div className="mb-8 overflow-x-auto rounded-md border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Key Present</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {providerManifest.map((p) => (
              <tr key={p.name} className="border-t border-line">
                <td className="px-4 py-2 font-medium text-ink">{p.name}</td>
                <td className="px-4 py-2 text-muted capitalize">{p.type}</td>
                <td className="px-4 py-2">{p.keyPresent ? <span className="text-green-600">Yes</span> : <span className="text-muted">No</span>}</td>
                <td className="px-4 py-2">
                  <Badge tone={p.enabled ? "brand" : "neutral"}>{p.enabled ? "Enabled" : "Disabled"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-ink">Job source integrations</h2>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Panel title="Configure source">
          <form action="/api/sources/manual-refresh" method="post" className="space-y-3">
            <TextInput name="name" placeholder="Source name" defaultValue="Apify LinkedIn Jobs" required />
            <Select name="type" defaultValue="APIFY">
              <option value="APIFY">Apify</option>
              <option value="SERPAPI">SerpAPI</option>
              <option value="RSS">RSS</option>
              <option value="CSV">CSV</option>
              <option value="MANUAL">Manual</option>
            </Select>
            <TextInput name="actorId" placeholder="Actor ID" />
            <TextInput name="apiTokenRef" placeholder="API token env var" defaultValue="APIFY_API_TOKEN" />
            <Select name="schedule" defaultValue="DAILY">
              <option value="MANUAL">Manual</option>
              <option value="DAILY">Daily</option>
              <option value="TWICE_DAILY">Twice daily</option>
              <option value="EVERY_6_HOURS">Every 6 hours</option>
            </Select>
            <TextArea name="searchParams" placeholder='{"titles":["Senior Data Engineer"],"locations":["Remote"]}' />
            <SubmitButton>Save source</SubmitButton>
          </form>
        </Panel>
        <Panel title="Configured sources">
          <div className="space-y-3">
            {sources.map((source) => (
              <div key={source.id} className="rounded-md border border-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{source.name}</div>
                    <div className="mt-1 text-sm text-muted">{source.type} · {source.schedule}</div>
                  </div>
                  <Badge tone={source.enabled ? "brand" : "neutral"}>{source.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <div className="mt-3 text-sm text-muted">Actor: {source.actorId || "N/A"} · Token: {source.apiTokenRef || "N/A"}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
