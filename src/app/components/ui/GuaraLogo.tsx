interface GuaraLogoProps {
  compact?: boolean;
  className?: string;
}

export function GuaraLogo({ compact = false, className = '' }: GuaraLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#2563EB] shadow-sm shadow-blue-900/20">
        <svg
          viewBox="0 0 32 32"
          className="h-6 w-6"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M16 3.5L26.8253 9.75V22.25L16 28.5L5.17468 22.25V9.75L16 3.5Z"
            fill="white"
            fillOpacity="0.14"
            stroke="white"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="11" cy="12" r="2.4" fill="white" />
          <circle cx="21" cy="12" r="2.4" fill="white" />
          <circle cx="16" cy="21" r="2.4" fill="white" />
          <path
            d="M13.1 13.4L15.1 18.7M18.9 18.7L20.9 13.4M13.5 12H18.5"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {!compact && (
        <div className="flex flex-col">
          <span
            style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.03em' }}
            className="leading-none text-white"
          >
            guara
          </span>
          <span
            style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em' }}
            className="mt-1 hidden uppercase leading-none text-slate-500 sm:block"
          >
            dependency intelligence
          </span>
        </div>
      )}
    </div>
  );
}
