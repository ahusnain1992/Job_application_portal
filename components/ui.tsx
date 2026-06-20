import clsx from "clsx";

export function PageHeader({ title, eyebrow, actions }: { title: string; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <div className="text-sm font-medium uppercase tracking-wide text-brand">{eyebrow}</div> : null}
        <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
      </div>
      {actions}
    </div>
  );
}

export function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "brand" | "warn" | "signal" }) {
  const tones = {
    neutral: "border-line bg-white",
    brand: "border-brand/30 bg-[#ECF7F4]",
    warn: "border-warn/30 bg-[#FFF6EB]",
    signal: "border-signal/30 bg-[#EEF5FF]"
  };
  return (
    <div className={clsx("rounded-lg border p-4 shadow-panel", tones[tone])}>
      <div className="text-sm font-medium text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}

export function Panel({ children, title, action }: { children: React.ReactNode; title?: string; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white shadow-panel">
      {title || action ? (
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
          {title ? <h2 className="text-base font-semibold text-ink">{title}</h2> : <div />}
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "brand" | "warn" | "danger" | "signal" }) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700",
    brand: "bg-[#DDF3ED] text-[#14544B]",
    warn: "bg-[#FFF0D8] text-[#8A4604]",
    danger: "bg-red-50 text-red-700",
    signal: "bg-blue-50 text-blue-700"
  };
  return <span className={clsx("inline-flex items-center rounded px-2 py-1 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return <button className="focus-ring inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-[#12564C]">{children}</button>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx("focus-ring h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx("focus-ring h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink", props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx("focus-ring min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink", props.className)} />;
}
