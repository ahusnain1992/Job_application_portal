import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export default async function HelpPage() {
  const user = await requireUser();
  const isAdmin = user.role === Role.ADMIN;

  return (
    <AppShell>
      <div className="max-w-3xl">
        <div className="text-sm font-medium uppercase tracking-wide text-brand">Support</div>
        <h1 className="mt-1 text-2xl font-semibold text-ink">How to Use This Portal</h1>
        <p className="mt-1 text-sm text-muted">Step-by-step guides for everything you need to do.</p>

        <div className="mt-8 space-y-10">

          {/* Employee guide */}
          <section>
            <h2 className="text-lg font-semibold text-ink border-b border-line pb-2 mb-4">
              Employee Guide — How to Apply for Jobs
            </h2>

            <div className="space-y-6">
              <GuideStep
                number={1}
                title="Start from your Dashboard"
                description="Every day when you log in, go to your Dashboard first. It shows how many applications you've done today, your daily target, and the top recommended jobs waiting for you."
                action={{ href: "/team", label: "Go to Dashboard" }}
              />

              <GuideStep
                number={2}
                title="Open your Queue"
                description="Click 'Go to My Queue' from the Dashboard, or tap 'My Queue' in the navigation. Jobs are sorted by priority — work from top to bottom. 'Apply Now' jobs are the best match and ready to go."
                action={{ href: "/queue", label: "Go to My Queue" }}
              />

              <GuideStep
                number={3}
                title="Open a job and read the details"
                description="Click any job card to open the job detail page. Read the match explanation and any warnings. Check which resume is recommended and if a cover letter is needed."
              />

              <GuideStep
                number={4}
                title="Open the job on the employer's website"
                description="Click the green 'Open Job' button. This opens the real job posting on the company's website in a new tab. Do NOT use LinkedIn Easy Apply — only apply through the company's own careers page."
                highlight="Never submit applications automatically. You must apply manually on the employer's website."
              />

              <GuideStep
                number={5}
                title="Apply on the employer's website"
                description="Fill in the application form on the company's careers page. Upload the correct resume (shown on the job page). Add a cover letter only if the job asks for one — use the 'Generate Cover Letter' button if you need one, but always review it first."
              />

              <GuideStep
                number={6}
                title="Save your proof"
                description="After submitting, copy the confirmation number from the thank-you page, or take a screenshot and save the link. You will need this to complete the record."
              />

              <GuideStep
                number={7}
                title="Come back and mark the result"
                description="Return to the job page in this portal. Enter the confirmation number or screenshot link in the 'Record what you did' section. Select the resume you used, then click 'Mark as Applied'."
              />

              <GuideStep
                number={8}
                title="If you can't apply — mark it as Skipped"
                description="If the job is no longer available, already filled, or not a good fit, use the 'Skip / Problem' tab and choose a reason. This keeps the queue clean for everyone."
              />
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-lg font-semibold text-ink border-b border-line pb-2 mb-4">
              Common Questions
            </h2>
            <div className="space-y-4">
              <FaqItem
                q="What does the match score mean?"
                a="It shows how well the job description matches the client's profile and resume. 75%+ means a strong match — prioritise these. Below 45% means the job may not be ideal, but you can still apply if there are no better options."
              />
              <FaqItem
                q="What is 'Needs Resume Rewrite'?"
                a="It means the client's current resume doesn't cover enough of the job's requirements. Use the 'Generate tailored resume' button on the job page to create a better version, then review it before applying."
              />
              <FaqItem
                q="The job says 'Missing link' — what do I do?"
                a="This means we don't have a direct apply URL for this job. Search for the company name and job title on Google to find the careers page manually."
              />
              <FaqItem
                q="Can I apply to the same job for two different clients?"
                a="Yes, if the same job appears in two client queues it means both clients are a good fit. Apply separately for each client using their own resume."
              />
              <FaqItem
                q="What if someone else already applied to this job?"
                a="The portal prevents duplicate applications. If a team member already applied, you'll see a green banner saying 'Applied by [name]'. Move on to the next job."
              />
              <FaqItem
                q="What is the daily target?"
                a="Your admin sets a daily target (default is 15 applications per day). The progress bar on your dashboard tracks how close you are. Skipped jobs don't count."
              />
            </div>
          </section>

          {/* Admin guide */}
          {isAdmin && (
            <section>
              <h2 className="text-lg font-semibold text-ink border-b border-line pb-2 mb-4">
                Admin Guide
              </h2>
              <div className="space-y-6">
                <GuideStep
                  number={1}
                  title="Add clients"
                  description="Go to Clients → Add New Client. Fill in the client's name, target job titles, location preferences, and paste their resume text into the CV field. The location picker lets you choose specific countries and cities."
                  action={{ href: "/clients", label: "Manage Clients" }}
                />
                <GuideStep
                  number={2}
                  title="Assign team members to clients"
                  description="Open a client profile and scroll to the Team Assignments section. Search for a team member and assign them. Only assigned team members will see that client's jobs in their queue."
                />
                <GuideStep
                  number={3}
                  title="Fetch new jobs"
                  description="Go to a client's profile page and click 'Fetch Jobs Now'. This runs the job search using the client's preferences and saves new matches. There is a 2-hour cooldown per client and a 6-hour global cooldown."
                />
                <GuideStep
                  number={4}
                  title="Review flagged applications"
                  description="If an employee applies in less than 3 minutes, the application is flagged. Go to Applications and filter by flagged. Open the application, review it, then click 'Flag reviewed by admin' to clear it."
                  action={{ href: "/applications", label: "View Applications" }}
                />
                <GuideStep
                  number={5}
                  title="Upload resume versions"
                  description="Go to Resumes and use the Add Resume Version form. Upload the PDF or paste a Google Drive link so employees can download it. Paste the full plain text of the resume so the app can match it to jobs automatically."
                  action={{ href: "/resumes", label: "Manage Resumes" }}
                />
                <GuideStep
                  number={6}
                  title="Monitor daily progress"
                  description="Go to the Applications page and set the date range to 'Today'. You can filter by team member to see who applied to what. The queue page also shows an applied-today count."
                  action={{ href: "/applications", label: "Applications" }}
                />
                <GuideStep
                  number={7}
                  title="Archive inactive clients"
                  description="If a client is no longer active, open their profile and click 'Archive Client'. This hides them from job queues but keeps all their history. You can reactivate at any time."
                />
              </div>
            </section>
          )}

        </div>
      </div>
    </AppShell>
  );
}

function GuideStep({
  number,
  title,
  description,
  action,
  highlight
}: {
  number: number;
  title: string;
  description: string;
  action?: { href: string; label: string };
  highlight?: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
        {number}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-ink">{title}</div>
        <p className="mt-1 text-sm text-muted leading-6">{description}</p>
        {highlight && (
          <div className="mt-2 rounded-md border border-warn/30 bg-[#FFF6EB] px-3 py-2 text-sm text-[#8A4604]">
            ⚠ {highlight}
          </div>
        )}
        {action && (
          <Link
            href={action.href}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            {action.label} →
          </Link>
        )}
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="font-semibold text-sm text-ink">{q}</div>
      <p className="mt-1.5 text-sm text-muted leading-6">{a}</p>
    </div>
  );
}
