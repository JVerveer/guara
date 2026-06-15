import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQS } from '../data/constants';
import { theme } from '../../styles/theme';

export function FAQPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <p
            style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: theme.brand.primary,
            }}
            className="uppercase mb-2"
          >
            FAQ
          </p>

          <h1
            style={{
              fontSize: 'clamp(22px, 3vw, 30px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: theme.neutral.text,
            }}
            className="mb-2"
          >
            Frequently asked questions
          </h1>

          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: theme.neutral.textSecondary,
            }}
          >
            Everything you need to know about Guara.
          </p>
        </div>

        <div className="space-y-2">
          {FAQS.map(({ q, a }, i) => {
            const isOpen = open === i;

            return (
              <div
                key={q}
                className="rounded-xl overflow-hidden shadow-sm"
                style={{
                  backgroundColor: theme.neutral.surface,
                  border: `1px solid ${theme.neutral.border}`,
                }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
                  style={{
                    backgroundColor: isOpen
                      ? theme.brand.primaryLight
                      : theme.neutral.surface,
                  }}
                  onMouseEnter={(event) => {
                    if (!isOpen) {
                      event.currentTarget.style.backgroundColor =
                        theme.neutral.background;
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (!isOpen) {
                      event.currentTarget.style.backgroundColor =
                        theme.neutral.surface;
                    }
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.neutral.text,
                    }}
                    className="pr-4"
                  >
                    {q}
                  </span>

                  <ChevronDown
                    className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    style={{
                      color: isOpen
                        ? theme.brand.primary
                        : theme.neutral.textMuted,
                    }}
                  />
                </button>

                {isOpen && (
                  <div
                    className="px-5 pb-4"
                    style={{
                      borderTop: `1px solid ${theme.neutral.border}`,
                    }}
                  >
                    <p
                      style={{
                        fontSize: '13px',
                        lineHeight: 1.7,
                        color: theme.neutral.textSecondary,
                      }}
                      className="pt-3"
                    >
                      {a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="mt-6 rounded-xl p-5 text-center"
          style={{
            backgroundColor: theme.brand.primaryLight,
            border: `1px solid ${theme.brand.primaryBorder}`,
          }}
        >
          <p
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.neutral.text,
            }}
          >
            Building your DORA programme?
          </p>

          <p
            style={{
              fontSize: '13px',
              lineHeight: 1.6,
              color: theme.neutral.textSecondary,
            }}
            className="mt-2"
          >
            Upload a sample package and see how Guara identifies technology
            dependencies, concentration risk, digital sovereignty concerns,
            AI Act exposure, and regulatory gaps.
          </p>

          <p
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: theme.brand.primary,
            }}
            className="mt-3 cursor-pointer"
            onMouseEnter={(event) => {
              event.currentTarget.style.color = theme.brand.primaryHover;
              event.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = theme.brand.primary;
              event.currentTarget.style.textDecoration = 'none';
            }}
          >
            hello@guara.io
          </p>
        </div>
      </div>
    </div>
  );
}
