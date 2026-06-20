import { PrismaClient, Role, WorkMode, EmploymentType, JobStatus, SourceType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

async function main() {
  await prisma.applicationStatusHistory.deleteMany();
  await prisma.application.deleteMany();
  await prisma.note.deleteMany();
  await prisma.jobAssignment.deleteMany();
  await prisma.job.deleteMany();
  await prisma.duplicateGroup.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.dailyTarget.deleteMany();
  await prisma.clientAssignment.deleteMany();
  await prisma.clientProfile.deleteMany();
  await prisma.jobSource.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  const [adminHash, memberHash] = await Promise.all([
    hashPassword("password123"),
    hashPassword("password123")
  ]);

  const [admin, maria, jamal] = await Promise.all([
    prisma.user.create({
      data: { name: "Ali Admin", email: "admin@portal.test", passwordHash: adminHash, role: Role.ADMIN }
    }),
    prisma.user.create({
      data: { name: "Maria Chen", email: "maria@portal.test", passwordHash: memberHash, role: Role.TEAM_MEMBER }
    }),
    prisma.user.create({
      data: { name: "Jamal Reed", email: "jamal@portal.test", passwordHash: memberHash, role: Role.TEAM_MEMBER }
    })
  ]);

  const client = await prisma.clientProfile.create({
    data: {
      clientName: "Nadia Rahman",
      currentJobTitle: "Senior Data Engineer",
      targetJobTitles: ["Senior Data Engineer", "GCP Data Engineer", "Analytics Engineer"],
      alternativeJobTitles: ["ETL Developer", "BI Engineer", "Data Warehouse Engineer"],
      yearsOfExperience: 9,
      mainSkills: ["SQL", "Python", "GCP", "BigQuery", "Airflow", "dbt"],
      secondarySkills: ["Tableau", "Power BI", "Healthcare data", "Spark"],
      preferredLocations: ["Remote", "Chicago, IL", "Dallas, TX"],
      workModePreference: WorkMode.REMOTE,
      employmentTypePreference: EmploymentType.FULL_TIME,
      minimumSalary: 145000,
      maximumSalary: 185000,
      resumeUrl: "https://example.com/resumes/nadia-senior-data-engineer.pdf",
      linkedinUrl: "https://linkedin.com/in/example-nadia",
      portfolioUrl: "https://github.com/example-nadia",
      workAuthorizationNotes: "Authorized for W2 roles. No sponsorship needed.",
      sponsorshipRequirement: "No sponsorship required",
      industriesPreferred: ["Healthcare", "Fintech", "SaaS"],
      industriesToAvoid: ["Defense"],
      keywordsInclude: ["SQL", "Python", "BigQuery", "Airflow"],
      keywordsExclude: ["active security clearance", "onsite only"],
      applicationNotes: "Prioritize company career pages. Avoid roles requiring active clearance."
    }
  });

  await prisma.clientAssignment.createMany({
    data: [
      { clientId: client.id, userId: maria.id },
      { clientId: client.id, userId: jamal.id }
    ]
  });

  await prisma.dailyTarget.createMany({
    data: [
      { clientId: client.id, userId: maria.id, target: 18 },
      { clientId: client.id, userId: jamal.id, target: 15 }
    ]
  });

  const resumes = await Promise.all([
    prisma.resume.create({
      data: {
        clientId: client.id,
        name: "Senior Data Engineer - GCP",
        fileUrl: "https://example.com/resumes/nadia-gcp.pdf",
        rewriteToolUrl: "https://example.com/rewrite/nadia-gcp"
      }
    }),
    prisma.resume.create({
      data: {
        clientId: client.id,
        name: "Healthcare Data Engineer",
        fileUrl: "https://example.com/resumes/nadia-healthcare.pdf"
      }
    })
  ]);

  const [manualSource, apifySource] = await Promise.all([
    prisma.jobSource.create({
      data: {
        name: "Manual Import",
        type: SourceType.MANUAL,
        schedule: "MANUAL"
      }
    }),
    prisma.jobSource.create({
      data: {
        name: "Apify LinkedIn Jobs",
        type: SourceType.APIFY,
        actorId: "apify/linkedin-jobs-scraper",
        apiTokenRef: "APIFY_API_TOKEN",
        schedule: "DAILY",
        searchParams: {
          titles: ["Senior Data Engineer", "GCP Data Engineer"],
          locations: ["Remote", "Chicago"]
        }
      }
    })
  ]);

  const duplicate = await prisma.duplicateGroup.create({
    data: {
      signature: "acme-health-senior-data-engineer-remote"
    }
  });

  const job1 = await prisma.job.create({
    data: {
      externalId: "acme-771",
      sourceId: manualSource.id,
      sourceName: manualSource.name,
      sourceUrl: "https://linkedin.com/jobs/view/acme-771",
      originalJobUrl: "https://linkedin.com/jobs/view/acme-771",
      companyName: "Acme Health",
      title: "Senior Data Engineer",
      location: "Remote",
      workMode: WorkMode.REMOTE,
      employmentType: EmploymentType.FULL_TIME,
      salaryMin: 150000,
      salaryMax: 180000,
      description: "Build healthcare data pipelines using SQL, Python, GCP, BigQuery, Airflow, and dbt.",
      requiredSkills: ["SQL", "Python", "GCP", "BigQuery", "Airflow"],
      preferredSkills: ["dbt", "Healthcare data"],
      postedDate: new Date(),
      applyUrl: "https://acmehealth.example/careers/senior-data-engineer",
      companyCareerPageUrl: "https://acmehealth.example/careers",
      atsPlatform: "Greenhouse",
      duplicateGroupId: duplicate.id,
      matchScore: 94,
      matchExplanation: "Strong match: Senior Data Engineer role, remote, salary aligned, and core skills match SQL, Python, GCP, BigQuery, and Airflow.",
      matchWarnings: [],
      status: JobStatus.ASSIGNED,
      clientId: client.id,
      assignedTeamMemberId: maria.id
    }
  });

  const job2 = await prisma.job.create({
    data: {
      externalId: "northwind-022",
      sourceId: apifySource.id,
      sourceName: apifySource.name,
      sourceUrl: "https://indeed.example/jobs/northwind-022",
      originalJobUrl: "https://indeed.example/jobs/northwind-022",
      companyName: "Northwind Analytics",
      title: "Analytics Engineer",
      location: "Chicago, IL",
      workMode: WorkMode.HYBRID,
      employmentType: EmploymentType.FULL_TIME,
      salaryMin: 130000,
      salaryMax: 160000,
      description: "Analytics engineering role focused on dbt, SQL, BigQuery, BI dashboards, and stakeholder reporting.",
      requiredSkills: ["SQL", "dbt", "BigQuery"],
      preferredSkills: ["Tableau", "Power BI"],
      postedDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
      applyUrl: "https://northwind.example/jobs/022",
      atsPlatform: "Lever",
      matchScore: 78,
      matchExplanation: "Good match: analytics engineering title and SQL, dbt, BigQuery skills align with the profile.",
      matchWarnings: ["Hybrid role; confirm the client can commute to Chicago."],
      status: JobStatus.SUGGESTED,
      clientId: client.id,
      assignedTeamMemberId: jamal.id
    }
  });

  const app = await prisma.application.create({
    data: {
      clientId: client.id,
      jobId: job1.id,
      status: JobStatus.APPLIED,
      assignedTeamMemberId: maria.id,
      appliedById: maria.id,
      appliedDateTime: new Date(),
      resumeId: resumes[0].id,
      notes: "Applied through Greenhouse using GCP resume.",
      lastUpdatedById: maria.id
    }
  });

  await prisma.applicationStatusHistory.create({
    data: {
      applicationId: app.id,
      status: JobStatus.APPLIED,
      changedById: maria.id,
      note: "Manual application completed."
    }
  });

  await prisma.job.update({
    where: { id: job1.id },
    data: {
      status: JobStatus.APPLIED,
      appliedById: maria.id,
      appliedDate: new Date(),
      resumeVersionUsed: resumes[0].name,
      notesText: "Applied through Greenhouse using GCP resume."
    }
  });

  await prisma.jobAssignment.createMany({
    data: [
      { jobId: job1.id, userId: maria.id },
      { jobId: job2.id, userId: jamal.id }
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, action: "CLIENT_CREATED", entity: "ClientProfile", entityId: client.id },
      { actorId: admin.id, action: "JOB_SOURCE_CONFIGURED", entity: "JobSource", entityId: apifySource.id },
      { actorId: maria.id, action: "APPLICATION_UPDATED", entity: "Application", entityId: app.id }
    ]
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
