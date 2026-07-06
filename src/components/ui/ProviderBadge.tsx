import { getProviderColor } from "@/theme/tokens";

interface ProviderBadgeProps {
  name: string;
}

export function ProviderBadge({ name }: ProviderBadgeProps) {
  const { fill } = getProviderColor(name);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase"
      style={{ backgroundColor: fill + "18", color: fill }}
    >
      {name}
    </span>
  );
}
