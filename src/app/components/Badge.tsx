const BADGE_STYLES: Record<string, string> = {
  Critical: 'bg-red-50 text-red-700 border-red-200',
  Important: 'bg-amber-50 text-amber-700 border-amber-200',
  Standard: 'bg-gray-50 text-gray-600 border-gray-200',
  High: 'bg-red-50 text-red-700 border-red-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-green-50 text-green-700 border-green-200',
  Valid: 'bg-green-50 text-green-700 border-green-200',
  Missing: 'bg-red-50 text-red-700 border-red-200',
  Expiring: 'bg-amber-50 text-amber-700 border-amber-200',
  Ready: 'bg-green-50 text-green-700 border-green-200',
};

export function Badge({ level }: { level: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${BADGE_STYLES[level] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {level}
    </span>
  );
}
