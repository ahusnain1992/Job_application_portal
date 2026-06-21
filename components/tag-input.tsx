"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function TagInput({ name, defaultValue = "", placeholder = "Type and press Enter or comma", required, className = "" }: TagInputProps) {
  const initial = defaultValue
    ? defaultValue.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const [tags, setTags] = useState<string[]>(initial);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const val = raw.trim();
    if (val && !tags.includes(val)) {
      setTags((prev) => [...prev, val]);
    }
    setInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function handleBlur() {
    if (input.trim()) addTag(input);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val.includes(",")) {
      const parts = val.split(",");
      parts.slice(0, -1).forEach((p) => addTag(p));
      setInput(parts[parts.length - 1]);
    } else {
      setInput(val);
    }
  }

  return (
    <div className={className}>
      {/* Hidden input carries the comma-separated value for form submission */}
      <input type="hidden" name={name} value={tags.join(", ")} />
      {/* Validation shim — required triggers if tags is empty */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={tags.length > 0 ? "ok" : ""}
          onChange={() => {}}
          className="absolute h-0 w-0 opacity-0 pointer-events-none"
        />
      )}

      <div
        onClick={() => inputRef.current?.focus()}
        className="focus-within:ring-2 focus-within:ring-brand/40 flex flex-wrap gap-1.5 rounded-md border border-line bg-white px-3 py-2 cursor-text min-h-[42px]"
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-sm font-medium text-brand"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="text-brand/60 hover:text-brand"
              tabIndex={-1}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>
      <p className="mt-1 text-xs text-muted">Press Enter or comma to add each item</p>
    </div>
  );
}
