import { formatDistanceToNowStrict, format } from "date-fns";
import { EmploymentType, JobStatus, Role, WorkMode } from "@prisma/client";

export function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function statusLabel(status: JobStatus) {
  if (status === "SAVED_FOR_LATER") return "Saved";
  if (status === "ERROR_COULD_NOT_APPLY") return "Could Not Apply";
  return label(status);
}

export function roleLabel(role: Role) {
  return role === "ADMIN" ? "Admin" : "Team Member";
}

export function workModeLabel(mode: WorkMode) {
  return label(mode);
}

export function employmentLabel(type: EmploymentType) {
  if (type === "FULL_TIME") return "Full-time";
  return label(type);
}

export function shortDate(date?: Date | null) {
  if (!date) return "Unknown";
  return format(date, "MMM d");
}

export function relativeDate(date?: Date | null) {
  if (!date) return "Unknown";
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function money(min?: number | null, max?: number | null) {
  if (!min && !max) return "Not listed";
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  if (min && max) return `${fmt.format(min)} - ${fmt.format(max)}`;
  return fmt.format(min || max || 0);
}
