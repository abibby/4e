import { useId } from "react";
import { useNavigation } from "react-router";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

export function Icon({
  name = "search",
  ...props
}: {
  name?: "search" | "book" | "arrow" | "filter";
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {name === "search" && (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </>
      )}
      {name === "book" && (
        <>
          <path d="M12 5v16M3 3l9 2 9-2v16l-9 2-9-2z" />
          <path d="m6 8 3 1m6 0 3-1M6 12l3 1m6 0 3-1" />
        </>
      )}
      {name === "arrow" && <path d="M4 12h16m-6-6 6 6-6 6" />}
      {name === "filter" && (
        <>
          <path d="M4 6h16M7 12h10m-7 6h4" />
          <circle cx="8" cy="6" r="2" fill="currentColor" />
          <circle cx="15" cy="12" r="2" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function InputField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} />
    </div>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: {
  label: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...props}>
        {children}
      </select>
    </div>
  );
}

export function SearchBox({
  defaultValue = "",
  busy = false,
}: {
  defaultValue?: string;
  busy?: boolean;
}) {
  const id = useId();
  const navigation = useNavigation();
  busy = busy || navigation.state !== "idle";
  return (
    <div className="search-box">
      <Icon />
      <label className="sr-only" htmlFor={id}>
        Search the compendium
      </label>
      <input
        id={id}
        name="q"
        type="search"
        placeholder="Search spells, creatures, items, and more…"
        defaultValue={defaultValue}
      />
      <button className="button primary" type="submit" disabled={busy}>
        {busy ? "Searching…" : "Search"}
        <Icon name="arrow" />
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  error = false,
}: {
  title: string;
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`empty-state${error ? " error-state" : ""}`}
      role={error ? "alert" : undefined}
    >
      <span className="state-icon">
        <Icon name={error ? "book" : "search"} />
      </span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
