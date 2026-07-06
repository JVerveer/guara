import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

/**
 * Generic loading indicator.
 * Includes role="status" and aria-live="polite" so screen readers
 * announce when content is being loaded.
 */
export function LoadingState({ message, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message ?? "Loading"}
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-20 text-center",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="block w-5 h-5 rounded-full border-2 border-border border-t-primary animate-spin"
      />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
