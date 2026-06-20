"use client";

import { useState, useRef } from "react";
import { Upload, Link2 } from "lucide-react";

interface FileUploadOrUrlProps {
  name: string;
  defaultValue?: string;
  accept?: string;
  placeholder?: string;
  className?: string;
}

export function FileUploadOrUrl({
  name,
  defaultValue = "",
  accept = ".pdf,.doc,.docx",
  placeholder = "https://drive.google.com/...",
  className = ""
}: FileUploadOrUrlProps) {
  const isDataUrl = defaultValue?.startsWith("data:");
  const [mode, setMode] = useState<"url" | "file">(isDataUrl ? "file" : "url");
  const [fileValue, setFileValue] = useState<string>(isDataUrl ? defaultValue : "");
  const [fileName, setFileName] = useState<string>(isDataUrl ? "Uploaded file" : "");
  const [urlValue, setUrlValue] = useState<string>(isDataUrl ? "" : defaultValue);
  const [error, setError] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5MB.");
      return;
    }

    setError("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setFileValue(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-white border border-line text-ink shadow-sm"
        : "text-muted hover:text-ink"
    }`;

  return (
    <div className={className}>
      <div className="mb-2 flex gap-1 rounded-md bg-canvas p-1 w-fit">
        <button type="button" onClick={() => setMode("url")} className={tabClass(mode === "url")}>
          <Link2 size={11} /> Paste URL
        </button>
        <button type="button" onClick={() => setMode("file")} className={tabClass(mode === "file")}>
          <Upload size={11} /> Upload file
        </button>
      </div>

      {mode === "url" ? (
        <input
          type="url"
          name={name}
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder={placeholder}
          className="focus-ring block w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted"
        />
      ) : (
        <div>
          <input type="hidden" name={name} value={fileValue} />
          <div
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-md border-2 border-dashed border-line bg-canvas px-4 py-6 text-center hover:border-brand/40 transition-colors"
          >
            <Upload size={20} className="mx-auto mb-2 text-muted" />
            {fileName ? (
              <div>
                <div className="text-sm font-medium text-ink">{fileName}</div>
                <div className="mt-1 text-xs text-muted">Click to replace</div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-medium text-ink">Click to upload</div>
                <div className="mt-1 text-xs text-muted">{accept.toUpperCase().replace(/\./g, "").replace(/,/g, ", ")} · Max 5MB</div>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
          {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}
