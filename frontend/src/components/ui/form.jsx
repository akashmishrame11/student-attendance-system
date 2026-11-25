import { forwardRef } from "react";
import { Search, Upload } from "lucide-react";

export function Field({ label, error, hint, required, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef(function Input({ error, className = "", ...props }, ref) {
  return <input ref={ref} className={`input ${error ? "input-error" : ""} ${className}`} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ error, className = "", rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={`input resize-y ${error ? "input-error" : ""} ${className}`} {...props} />;
});

export const Select = forwardRef(function Select({ error, options = [], placeholder = "Select…", className = "", ...props }, ref) {
  return (
    <select ref={ref} className={`input pr-8 ${error ? "input-error" : ""} ${className}`} {...props}>
      {placeholder !== false && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, className = "", ...props }, ref) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 ${className}`}>
      <input ref={ref} type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-brand-600" {...props} />
      {label}
    </label>
  );
});

export const FileInput = forwardRef(function FileInput({ accept, multiple, files, className = "", ...props }, ref) {
  const list = files ? Array.from(files) : [];
  return (
    <div className={className}>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:border-brand-400 hover:bg-brand-50/40">
        <Upload className="h-5 w-5 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">Click to choose {multiple ? "files" : "a file"}</span>
        <span className="text-xs text-slate-500">{accept ? accept.replaceAll(",", ", ") : "PDF, DOC, DOCX, JPG, PNG"} · max 10MB</span>
        <input ref={ref} type="file" accept={accept} multiple={multiple} className="sr-only" {...props} />
      </label>
      {list.length > 0 && (
        <ul className="mt-2 space-y-1">
          {list.map((f) => (
            <li key={f.name} className="truncate text-xs text-slate-600">📎 {f.name} ({Math.round(f.size / 1024)} KB)</li>
          ))}
        </ul>
      )}
    </div>
  );
});

export function SearchInput({ value, onChange, placeholder = "Search…", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-9" type="search" />
    </div>
  );
}

/** Compact select used in filter bars. */
export function FilterSelect({ value, onChange, options, placeholder = "All", className = "" }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`input w-auto min-w-36 max-w-64 ${className}`}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
