import * as React from "react";
import type { CampaignStatus } from "@gaa/shared";

/**
 * KodoAI Editorial Brutalism — UI Primitives (Module 7)
 *
 * Rules:
 * - border-radius: 0 everywhere (enforced by tailwind config + CSS reset)
 * - Font: --mono for labels/meta/buttons, --display for headings, --sans for body
 * - Accent (#c8f060) sparingly: interactive states, primary CTAs, emphasis
 * - All exported names/props match the old API so existing imports keep working
 */

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ─── Button ────────────────────────────────────────────────────────────────
   Mono uppercase, 1px border. Primary: accent bg + dark text. Ghost: subtle.
   ─────────────────────────────────────────────────────────────────────────── */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const base = [
    "inline-flex items-center justify-center gap-2",
    "font-mono text-[11px] font-[500] tracking-[0.15em] uppercase",
    "border transition-all duration-200",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
  ].join(" ");

  const sizes = {
    sm: "px-3 py-2",
    md: "px-5 py-3",
  };

  const variants = {
    primary:
      "bg-accent text-bg border-accent font-[600] hover:bg-accent-dim hover:border-accent-dim",
    secondary:
      "bg-transparent text-ink-2 border-border hover:border-accent hover:text-ink",
    ghost:
      "bg-transparent text-ink-3 border-transparent hover:border-border hover:text-ink-2",
    danger:
      "bg-transparent text-red border-red hover:bg-red-bg",
  } as const;

  return (
    <button
      className={cx(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}

/* ─── Input ─────────────────────────────────────────────────────────────────
   surface-2 bg, 1px border, accent on focus. No radius.
   ─────────────────────────────────────────────────────────────────────────── */
export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full border border-border bg-surface-2 px-4 py-3",
        "font-sans text-sm text-ink placeholder:text-ink-3",
        "transition-colors duration-200",
        "focus:outline-none focus:border-accent",
        "disabled:bg-bg disabled:text-ink-3 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

/* ─── Textarea ───────────────────────────────────────────────────────────── */
export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full border border-border bg-surface-2 px-4 py-3",
        "font-sans text-sm text-ink placeholder:text-ink-3",
        "transition-colors duration-200 resize-y",
        "focus:outline-none focus:border-accent",
        "disabled:bg-bg disabled:text-ink-3 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

/* ─── Select ────────────────────────────────────────────────────────────────
   Matches Input styling; native select for accessibility.
   ─────────────────────────────────────────────────────────────────────────── */
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "w-full border border-border bg-surface-2 px-4 py-3",
        "font-sans text-sm text-ink",
        "transition-colors duration-200 appearance-none",
        "focus:outline-none focus:border-accent",
        "disabled:bg-bg disabled:text-ink-3 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* ─── Field ─────────────────────────────────────────────────────────────────
   Label uses mono uppercase with `// ` prefix per design system §3.2.
   ─────────────────────────────────────────────────────────────────────────── */
export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="block font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3"
      >
        {"// "}{label}
        {required && <span className="text-red ml-1">*</span>}
      </label>
      {children}
      {hint && (
        <p className="font-mono text-[12px] tracking-[0.05em] text-ink-3 leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ─── Card ──────────────────────────────────────────────────────────────────
   surface bg, 1px border, 24px 28px padding. No radius.
   ─────────────────────────────────────────────────────────────────────────── */
export function Card({
  className,
  featured,
  children,
}: {
  className?: string;
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "bg-surface border p-6",
        featured ? "border-accent-dim" : "border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ─── SectionTitle ───────────────────────────────────────────────────────────
   Barlow Condensed uppercase H4-level heading for card/section titles.
   ─────────────────────────────────────────────────────────────────────────── */
export function SectionTitle({
  children,
  description,
}: {
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-[18px] font-[700] uppercase tracking-[-0.005em] text-ink leading-[1.1]">
        {children}
      </h2>
      {description && (
        <p className="mt-1 font-mono text-[12px] tracking-[0.05em] text-ink-3">
          {description}
        </p>
      )}
    </div>
  );
}

/* ─── Badge ─────────────────────────────────────────────────────────────────
   Mono uppercase, 1px border. Variants: default, accent, success, warning, error.
   ─────────────────────────────────────────────────────────────────────────── */
export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: "default" | "accent" | "success" | "warning" | "error" | "info";
  className?: string;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center px-3 py-1.5 border font-mono text-[11px] font-[500] tracking-[0.15em] uppercase leading-none";

  const variants = {
    default: "border-border bg-transparent text-ink-3",
    accent: "border-accent bg-transparent text-accent",
    success: "border-green bg-green-bg text-green",
    warning: "border-amber bg-amber-bg text-amber",
    error: "border-red bg-red-bg text-red",
    info: "border-blue bg-blue-bg text-blue",
  } as const;

  return (
    <span className={cx(base, variants[variant], className)}>{children}</span>
  );
}

/* ─── StatusBadge ───────────────────────────────────────────────────────────
   Maps CampaignStatus → label + semantic Badge variant. Single source of truth
   for status colors across the entire dashboard.
   ─────────────────────────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  draft: { label: "Draft", variant: "default" },
  pending_approval: { label: "Pending Approval", variant: "warning" },
  scheduled: { label: "Scheduled", variant: "info" },
  running: { label: "Running", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  completed: { label: "Completed", variant: "default" },
  archived: { label: "Archived", variant: "default" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: CampaignStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "default" as const };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

/* ─── PageHeader ────────────────────────────────────────────────────────────
   Standard page header: eyebrow (mono) + H1 (display) + optional meta + actions.
   ─────────────────────────────────────────────────────────────────────────── */
export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
      <div>
        {eyebrow && (
          <p className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3 mb-2">
            {"// "}{eyebrow}
          </p>
        )}
        <h1 className="font-display text-[40px] md:text-[56px] font-[800] uppercase tracking-[-0.01em] text-ink leading-[1]">
          {title}
        </h1>
        {meta && (
          <div className="mt-2 font-mono text-[12px] tracking-[0.05em] text-ink-3">
            {meta}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}

/* ─── EmptyState ─────────────────────────────────────────────────────────────
   Guided empty state with a mono label, display headline, description, and CTA.
   ─────────────────────────────────────────────────────────────────────────── */
export function EmptyState({
  label,
  title,
  description,
  action,
}: {
  label: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-border-2 p-12 text-center">
      <p className="font-mono text-[11px] font-[500] tracking-[0.15em] uppercase text-ink-3 mb-3">
        {"// "}{label}
      </p>
      <h3 className="font-display text-[28px] md:text-[36px] font-[800] uppercase tracking-[-0.008em] text-ink leading-[1] mb-3">
        {title}
      </h3>
      {description && (
        <p className="font-sans text-sm text-ink-3 max-w-sm mx-auto leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}

/* ─── Alert ──────────────────────────────────────────────────────────────────
   Left-border accent alert box. Matches DesignSystem.md §5.8.
   ─────────────────────────────────────────────────────────────────────────── */
export function Alert({
  variant = "info",
  children,
  className,
}: {
  variant?: "info" | "success" | "warning" | "error";
  children: React.ReactNode;
  className?: string;
}) {
  const variants = {
    info: "border-l-blue bg-blue-bg text-blue",
    success: "border-l-green bg-green-bg text-green",
    warning: "border-l-amber bg-amber-bg text-amber",
    error: "border-l-red bg-red-bg text-red",
  } as const;

  return (
    <div
      className={cx(
        "px-5 py-4 border-l-[3px] border-t border-r border-b border-transparent",
        "font-sans text-sm leading-relaxed",
        variants[variant],
        className,
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
