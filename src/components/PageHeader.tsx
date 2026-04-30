import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageHeaderProps {
  /** Small uppercase eyebrow above the title (mono, tracked-out). */
  eyebrow: string;
  /** Main page title — rendered in display font, large. */
  title: string;
  /** Optional supporting one-liner below the title. */
  description?: ReactNode;
  /** Right-side actions (buttons, filters). */
  actions?: ReactNode;
}

/**
 * Editorial page header used across every top-level route.
 * Eyebrow + display title + optional description + right-aligned actions,
 * with a hairline rule below to separate from content.
 */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="space-y-3 pt-2">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-end justify-between gap-4"
      >
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] text-mono uppercase tracking-[0.25em] text-muted-foreground/70">
            {eyebrow}
          </p>
          <h1 className="text-display text-2xl md:text-3xl font-semibold leading-none truncate">
            {title}
          </h1>
          {description && (
            <p className="text-[12.5px] leading-relaxed text-muted-foreground max-w-xl pt-1">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </motion.div>
      <div className="hairline" />
    </div>
  );
}

/**
 * Section header — used inside a page to label a region.
 * Smaller, all-caps, tracked-out. Pair with surface-1/2 panels.
 */
export function SectionLabel({ children, count, accent }: { children: ReactNode; count?: number | string; accent?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-[10px] uppercase tracking-[0.22em] font-medium text-muted-foreground/80">
        {children}
      </p>
      {(count !== undefined || accent) && (
        <div className="flex items-center gap-2">
          {accent}
          {count !== undefined && (
            <span className="text-[10px] text-mono tabular-nums text-muted-foreground/60">
              {count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
