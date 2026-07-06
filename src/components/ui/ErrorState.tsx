import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  /** If provided, renders a "Try again" button */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Generic error state.
 * Rendered when a data fetch fails. Uses role="alert" so screen readers
 * announce the error immediately.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-20 text-center px-6",
        className
      )}
    >
      <AlertCircle size={24} className="text-destructive/70" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-[15px] font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
