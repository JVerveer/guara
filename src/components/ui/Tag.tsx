interface TagProps {
  label: string;
}

export function Tag({ label }: TagProps) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-medium">
      {label}
    </span>
  );
}
