// Small presentational helpers (server components — no client JS needed).
import type { ReactNode } from "react";

export function Card({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="topbar">
          {title ? <h2 style={{ margin: 0 }}>{title}</h2> : <span />}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{value}</span>;
}

export function ConfidenceBadge({ level }: { level: string }) {
  return <span className={`badge ${level}`}>{level} confidence</span>;
}

export function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="banner error">{error}</div>;
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return <div className="banner info">{children}</div>;
}

export function OkBanner({ children }: { children: ReactNode }) {
  return <div className="banner ok">{children}</div>;
}

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label} {hint && <span className="hint">— {hint}</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </div>
  );
}

export function TextArea({
  label,
  name,
  required,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label} {hint && <span className="hint">— {hint}</span>}
      </label>
      <textarea id={name} name={name} required={required} defaultValue={defaultValue} />
    </div>
  );
}

export function Select({
  label,
  name,
  options,
  required,
  defaultValue,
  includeBlank,
  hint,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
  includeBlank?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label} {hint && <span className="hint">— {hint}</span>}
      </label>
      <select id={name} name={name} required={required} defaultValue={defaultValue ?? ""}>
        {includeBlank !== undefined && <option value="">{includeBlank}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Checkbox({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="check">
      <input id={name} name={name} type="checkbox" value="true" defaultChecked={defaultChecked} />
      <label htmlFor={name} style={{ marginBottom: 0 }}>
        {label}
      </label>
    </div>
  );
}

export function enumOptions(values: readonly string[]): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: prettyEnum(v) }));
}

export function prettyEnum(v: string): string {
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
