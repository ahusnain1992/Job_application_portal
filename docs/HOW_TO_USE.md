# Job Application Operations Portal — How-To Guide

> **Version:** June 2026  
> **Audience:** Admin and Team Member (Employee)

---

## Table of Contents

1. [What this portal does](#what-this-portal-does)
2. [Roles at a glance](#roles-at-a-glance)
3. [Admin Guide](#admin-guide)
   - [1. Set up your first client](#1-set-up-your-first-client)
   - [2. Upload resume versions](#2-upload-resume-versions)
   - [3. Assign team members to clients](#3-assign-team-members-to-clients)
   - [4. Set daily application targets](#4-set-daily-application-targets)
   - [5. Fetch new jobs](#5-fetch-new-jobs)
   - [6. Monitor daily progress](#6-monitor-daily-progress)
   - [7. Review flagged applications](#7-review-flagged-applications)
   - [8. Archive or delete a client](#8-archive-or-delete-a-client)
   - [9. Manage team accounts](#9-manage-team-accounts)
4. [Employee Guide](#employee-guide)
   - [1. Log in and see your dashboard](#1-log-in-and-see-your-dashboard)
   - [2. Open your queue](#2-open-your-queue)
   - [3. Apply to a job — step by step](#3-apply-to-a-job--step-by-step)
   - [4. Skip or flag a job](#4-skip-or-flag-a-job)
   - [5. Download a resume](#5-download-a-resume)
   - [6. Track your applications](#6-track-your-applications)
5. [Key rules for employees](#key-rules-for-employees)
6. [FAQ](#faq)
7. [Glossary](#glossary)

---

## What this portal does

The portal helps a small operations team manually submit job applications on behalf of clients. The system:

- Automatically finds and scores job postings that match each client's profile.
- Matches the best resume version to each job.
- Assigns jobs to team members as a prioritised queue.
- Records every application with proof (confirmation number or screenshot).
- Flags suspicious activity (e.g. applications submitted in under 3 minutes).

**The portal does NOT auto-submit applications.** Every application must be filled in manually on the employer's website.

---

## Roles at a glance

| Feature | Admin | Team Member |
|---------|-------|-------------|
| See all clients | ✓ | Only assigned clients |
| Add / edit clients | ✓ | ✗ |
| Upload resume versions | ✓ | ✗ |
| Set daily targets | ✓ | ✗ |
| Fetch jobs | ✓ | ✗ |
| View and work the queue | ✓ | ✓ |
| Submit applications | ✓ | ✓ |
| View all applications | ✓ | Own applications only |
| Archive / delete clients | ✓ | ✗ |

---

## Admin Guide

### 1. Set up your first client

**Go to:** Clients → (scroll down) "Add new client" toggle

Fill in every required field:

| Field | Notes |
|-------|-------|
| **Client full name** | First and last name exactly as it appears on their resume |
| **Current job title** | Their present role, e.g. "Senior Data Engineer" |
| **Target job titles** | 3–4 titles the app will search for. Press Enter after each one |
| **Main skills** | Keywords used for job matching. Add 6–12 core skills |
| **Preferred locations** | Cities or "Remote". Press Enter after each |
| **Work authorisation** | Important — affects which jobs are shown and what the team tells employers |
| **Application notes** | This text appears on every job the team works for this client. Use it for standing instructions: "Avoid roles requiring security clearance", "Always use the career page, not LinkedIn Easy Apply" |

After creating the client, open their profile and fill in the **Personal Information** tab — date of birth, phone, address, education, and EEO fields. Employees will copy this information directly into application forms.

---

### 2. Upload resume versions

**Go to:** Resumes → (scroll to client section) → "Add resume version" form on the left

A client can have multiple resume versions (e.g. one for Data Engineer roles and one for Cloud roles).

**Two-step upload:**

1. **Upload the file** — paste a Google Drive link or upload a PDF. This is what the team downloads to attach to applications.
2. **Paste the resume text** — open the PDF, select all (`Cmd+A`), copy, and paste into the text box. **Without text, the app cannot match this resume to jobs.**

> ⚠ Uploading a file alone is not enough. The app needs the plain text to calculate match scores and pick the best resume for each job.

Each resume shows either:
- **ATS ready** (green) — file + text both present. Ready for matching and download.
- **Text missing** (orange) — file present but text not pasted. Can be downloaded but not matched.

---

### 3. Assign team members to clients

**Go to:** Clients → open a client profile → scroll to "Team assignments"

Search for a team member and click Assign. Only assigned team members will see this client's jobs in their queue and dashboard. A team member can be assigned to multiple clients.

---

### 4. Set daily application targets

**Go to:** Settings & Users → Team member list → "Target/day" field

Enter a number next to each team member and click **Set**. The default is 15 applications per day. The employee's dashboard shows a progress bar toward this target every day.

---

### 5. Fetch new jobs

**Go to:** Clients → open a client profile → click **Fetch Jobs Now**

The app searches job boards for postings that match the client's target titles, skills, and location preferences. Each posting is scored and the best-matching resume version is automatically selected.

**Limits:**
- 2-hour cooldown per client
- 6-hour global cooldown (across all clients)

New jobs appear in the queue as **New** or **Suggested** status.

You can also add a job manually from the Jobs page using the "Manual import" toggle at the bottom. Paste the job description and the app will score it automatically.

---

### 6. Monitor daily progress

**Go to:** Applications → set date range to **Today** or **This week**

Key things to check:

- **Applied count** — total submissions today
- **Missing proof** — applications marked Applied but with no confirmation number or screenshot. Follow up with the team member.
- **Flagged fast** — applications submitted in under 3 minutes. These may not have been filled in properly. Click the application and review it.

The Admin Dashboard (`/admin`) also shows:
- Top-scoring jobs not yet applied to
- Incomplete opens (jobs opened but not finished)
- Recent applications with proof status

---

### 7. Review flagged applications

An application is automatically flagged if it was submitted in less than 3 minutes. This doesn't mean it was wrong — some applications are genuinely quick — but it should be reviewed.

**Go to:** Applications → look for the ⚑ Fast badge

Open the application, verify that:
- The status is correct
- There is a confirmation number or screenshot link
- The resume used makes sense

If everything looks correct, click **Flag reviewed by admin** to clear the flag.

---

### 8. Archive or delete a client

**Archive (recommended):**
Clients → open profile → Archive Client. The client is hidden from queues but all history is preserved. You can reactivate at any time.

**Permanent delete (cannot be undone):**
Only available for INACTIVE (archived) clients. Go to the Clients list, find the client in the "Archived clients" section, and click the **Delete** button. You will be asked to type the client's name to confirm.

> ⚠ Permanent deletion removes all jobs, applications, and resumes for that client. This cannot be reversed.

---

### 9. Manage team accounts

**Go to:** Settings & Users → Team members section

- **Create account** — enter name, email, and a temporary password. The team member can change their password after logging in.
- **Deactivate** — blocks login without deleting the account. History is preserved.
- **Reactivate** — restores access.

---

## Employee Guide

### 1. Log in and see your dashboard

Go to the portal URL and enter your email and password. You will land on your **Dashboard** (`/team`).

Your dashboard shows:
- **Daily target progress** — how many applications you've submitted today vs. your target
- **My clients** — the clients you are assigned to
- **Next recommended jobs** — the top 6 jobs ready for you to apply to, sorted by match score
- **Follow-ups needed** — jobs that may need a status update

---

### 2. Open your queue

Click **Go to My Queue** from the dashboard, or click **My Queue** in the sidebar.

Your queue is organised into four sections:

| Section | What to do |
|---------|------------|
| **Apply Now** | Strong match. Resume is ready. Apply these first. |
| **Ready to Apply** | Good match. Review the job before opening. |
| **Needs Resume Rewrite** | The resume needs updating before applying. Click "Rewrite Resume" and wait for admin to process. |
| **Review Required** | Lower match score. Check with your admin before applying. |

Work from top to bottom. Start with **Apply Now** jobs.

---

### 3. Apply to a job — step by step

1. Click on a job card in your queue.
2. Read the **client banner** at the top — it shows which client this is for and which resume to use.
3. Read the **How to apply** instructions (green box).
4. Click **Open Job & Start Applying** — this opens the employer's careers page in a new tab and marks the job as "In Progress".
5. On the employer's website, fill in the application form manually. Use the **client information panel** on the job detail page to copy fields (name, address, phone, education, etc.).
6. Submit the application on the employer's website.
7. Come back to the portal and enter either:
   - The **confirmation number** from the employer's confirmation page, or
   - A **screenshot link** (paste a Google Drive or Dropbox link to a screenshot of the confirmation)
8. Select the resume you used from the dropdown.
9. Click **Mark as Applied**.

> ⚠ Do not click "Mark as Applied" before you have actually submitted the application on the employer's website.

---

### 4. Skip or flag a job

If a job is not suitable for the client:

- Click **Skip** and select a reason (e.g. "Location mismatch", "Overqualified", "Already applied elsewhere").

If you ran into a technical problem (broken link, form error, login required):

- Click **Problem** and describe what happened.

If you need help or are unsure whether to apply:

- Click **Needs Help** to flag it for your admin.

---

### 5. Download a resume

**Go to:** Resumes in the sidebar

Find the client and download the correct resume version by clicking **Open file**. Use this file to attach to the application on the employer's website.

The resume panel on the job detail page also shows which resume to use and a direct download link.

---

### 6. Track your applications

**Go to:** My Applications in the sidebar

This shows all applications you have submitted, with status, proof, and date. The default view shows the last 7 days. Change the date range using the filter buttons.

If you see **Missing proof** on an application you submitted, go back and add the confirmation number or screenshot link.

---

## Key rules for employees

1. **Never submit an application without visiting the employer's website.** The "Open Job" button must be clicked first.
2. **Always add proof** — confirmation number or screenshot link — before marking as Applied.
3. **Do not use the resume text from the portal to auto-fill forms.** Copy fields one at a time from the client information panel.
4. **Do not share client personal information** outside the portal.
5. **If a job takes more than 20 minutes**, mark it as "Problem" and describe what happened. Do not leave it as In Progress.
6. **If you are unsure about a job**, skip it or use "Needs Help" — do not guess.

---

## FAQ

**Q: I can see a job for a client I'm not assigned to. Is that normal?**  
A: No. If you see jobs for clients you are not assigned to, contact your admin immediately. You should only see jobs for clients listed under "My clients" on your dashboard.

**Q: The job link is broken or goes to a login page. What do I do?**  
A: Click **Problem**, select "Broken link / can't access job", and describe what you saw. Do not mark it as Applied.

**Q: I submitted an application but forgot to add proof. Can I add it later?**  
A: Yes. Go to My Applications, find the application, click on the job title, scroll to the "Record what you did" panel, add the confirmation number or screenshot, and save.

**Q: The resume on the job detail page says "Text missing". What does that mean?**  
A: The admin hasn't pasted the resume text yet. You can still download the file, but the app couldn't automatically match this resume to jobs. Ask your admin to paste the resume text.

**Q: I accidentally marked a job as Applied when it should be Skipped. What do I do?**  
A: Contact your admin. Only admins can change a completed application status.

**Q: Why does the job say "Location does not match client preferences"?**  
A: The job location is different from what the client listed as preferred. You can still apply — check the job details and client notes to decide. If unsure, ask your admin.

**Q: The queue says 0 jobs but I know there are new jobs. Why?**  
A: The queue only shows jobs in actionable statuses (New, Suggested, Approved, Assigned, In Progress, Follow-up needed). Jobs that are already Applied or Skipped do not appear. If you expect new jobs, ask your admin to fetch jobs for the client.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Client** | A person whose job applications the team manages |
| **Queue** | The list of jobs assigned to you that need to be worked |
| **Match score** | A 0–100% score showing how well a job matches the client's skills and preferences |
| **Best resume** | The resume version the AI selected as the best fit for a specific job |
| **ATS ready** | A resume version that has both a file and pasted text — ready for job matching |
| **Text missing** | A resume with a file but no pasted text — cannot be used for job matching |
| **Confirmation number** | The reference number shown by the employer after a successful application submission |
| **Proof** | Evidence that the application was submitted: a confirmation number or a screenshot link |
| **Flagged fast** | An application submitted in under 3 minutes — reviewed by admin to verify it was done properly |
| **Active client** | A client whose jobs appear in the queue |
| **Archived client** | A client who is no longer active — their jobs are hidden from the queue but history is preserved |
| **Daily target** | The number of applications a team member is expected to submit per day (default: 15) |
| **Follow-up needed** | A job that was applied to and may need a status check (e.g. to ask for an update) |
| **In Progress** | A job that was opened but not yet marked as Applied or Skipped |
| **Rewrite needed** | The AI determined the current resume needs significant changes before it can be used for this job |
