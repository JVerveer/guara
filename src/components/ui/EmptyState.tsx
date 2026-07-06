import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Optional call-to-action button or link */
  action?: ReactNode;
  /** Optional icon to render above the title */
  icon?: ReactNode;
  className?: string;
}

/**
 * Generic empty-state placeholder.
 * Rendered when a list or query returns no results.
 */
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-20 text-center px-6",
        className
      )}
    >
      {icon && (
        <span aria-hidden="true" className="text-muted-foreground/40">
          {icon}
        </span>
      )}
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
