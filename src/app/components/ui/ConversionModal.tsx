import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  LockKeyhole,
  Mail,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { theme } from '../../../styles/theme';

type ConversionIntent = 'save' | 'export' | 'upload';

interface ConversionModalProps {
  open: boolean;
  intent?: ConversionIntent;
  onClose: () => void;
}

const INTENT_COPY: Record<
  ConversionIntent,
  {
    icon: typeof Download;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  }
> = {
  save: {
    icon: FileText,
    title: 'Save this analysis',
    description:
      'Create a free account to keep this sample analysis, compare future runs, and upload your own vendor documents next.',
    primaryCta: 'Save Analysis',
    secondaryCta: 'Continue exploring',
  },
  export: {
    icon: Download,
    title: 'Your board pack is ready',
    description:
      'Create a free account to download the generated board and audit package, including the dependency map, evidence summary, and risk findings.',
    primaryCta: 'Download Board Pack',
    secondaryCta: 'Preview first',
  },
  upload: {
    icon: Upload,
    title: 'Analyze your own vendor package',
    description:
      'Upload your own contracts, vendor lists, questionnaires, SOC reports, certificates, and registers to generate a private analysis.',
    primaryCta: 'Start Private Analysis',
    secondaryCta: 'Keep using sample',
  },
};

export function ConversionModal({
  open,
  intent = 'save',
  onClose,
}: ConversionModalProps) {
  const { activeScenario } = useApp();

  if (!open) {
    return null;
  }

  const copy = INTENT_COPY[intent];
  const Icon = copy.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.40)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl"
        style={{ backgroundColor: theme.neutral.surface }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="relative border-b px-6 py-5"
          style={{
            backgroundColor: theme.neutral.background,
            borderColor: theme.neutral.border,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 transition-colors"
            style={{
              color: theme.neutral.textMuted,
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = theme.neutral.surface;
              event.currentTarget.style.color = theme.neutral.text;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = 'transparent';
              event.currentTarget.style.color = theme.neutral.textMuted;
            }}
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: theme.brand.primaryLight }}
          >
            <Icon className="h-5 w-5" style={{ color: theme.brand.primary }} />
          </div>

          <h3
            style={{
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: theme.neutral.text,
            }}
            className="mb-2"
          >
            {copy.title}
          </h3>

          <p
            style={{
              fontSize: '13px',
              lineHeight: 1.6,
              color: theme.neutral.textSecondary,
            }}
            className="max-w-md"
          >
            {copy.description}
          </p>
        </div>

        <div className="px-6 py-5">
          <div
            className="mb-4 rounded-2xl border p-4"
            style={{
              backgroundColor: theme.neutral.background,
              borderColor: theme.neutral.border,
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: theme.neutral.text,
                  }}
                >
                  {activeScenario.name}
                </p>

                <p
                  style={{
                    fontSize: '11px',
                    color: theme.neutral.textSecondary,
                  }}
                >
                  {activeScenario.headlineFinding}
                </p>
              </div>

              <div
                className="rounded-xl px-3 py-2 text-right shadow-sm"
                style={{ backgroundColor: theme.neutral.surface }}
              >
                <p
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: theme.brand.primary,
                  }}
                >
                  {activeScenario.readinessScore}
                </p>

                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  score
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                {
                  label: 'Vendors',
                  value: activeScenario.vendors,
                },
                {
                  label: 'Critical',
                  value: activeScenario.criticalVendors,
                },
                {
                  label: 'Docs',
                  value: activeScenario.documents,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl p-2"
                  style={{ backgroundColor: theme.neutral.surface }}
                >
                  <p
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color: theme.neutral.text,
                    }}
                  >
                    {value}
                  </p>

                  <p
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: theme.neutral.textSecondary,
                    }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4 space-y-2">
            {[
              'Keep the generated analysis and board-ready output.',
              'Upload your own vendor package when ready.',
              'No credit card required for the private beta.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
                  style={{ color: theme.status.success }}
                />

                <p
                  style={{
                    fontSize: '12px',
                    lineHeight: 1.5,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  {item}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-3">
            <label
              htmlFor="conversion-email"
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: theme.neutral.textSecondary,
              }}
              className="mb-1.5 block"
            >
              Work email
            </label>

            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
              style={{
                backgroundColor: theme.neutral.surface,
                borderColor: theme.neutral.border,
              }}
              onFocusCapture={(event) => {
                event.currentTarget.style.borderColor = theme.brand.primary;
                event.currentTarget.style.boxShadow = `0 0 0 2px ${theme.brand.primaryBorder}`;
              }}
              onBlurCapture={(event) => {
                event.currentTarget.style.borderColor = theme.neutral.border;
                event.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Mail
                className="h-4 w-4 flex-shrink-0"
                style={{ color: theme.neutral.textMuted }}
              />

              <input
                id="conversion-email"
                type="email"
                placeholder="you@company.com"
                className="w-full bg-transparent outline-none"
                style={{
                  fontSize: '14px',
                  color: theme.neutral.text,
                }}
              />
            </div>
          </div>

          <button
            type="button"
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 transition-colors"
            style={{
              fontSize: '14px',
              fontWeight: 800,
              backgroundColor: theme.brand.primary,
              color: theme.sidebar.activeText,
              boxShadow: theme.shadow.brand,
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = theme.brand.primaryHover;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = theme.brand.primary;
            }}
          >
            {copy.primaryCta}
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl px-4 py-2.5 transition-colors"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: 'transparent',
              color: theme.neutral.textSecondary,
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = theme.neutral.background;
              event.currentTarget.style.color = theme.neutral.text;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = 'transparent';
              event.currentTarget.style.color = theme.neutral.textSecondary;
            }}
          >
            {copy.secondaryCta}
          </button>

          <div
            className="mt-4 flex items-start gap-2 rounded-xl border p-3"
            style={{
              backgroundColor: theme.neutral.background,
              borderColor: theme.neutral.border,
            }}
          >
            <LockKeyhole
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              style={{ color: theme.neutral.textSecondary }}
            />

            <p
              style={{
                fontSize: '11px',
                lineHeight: 1.5,
                color: theme.neutral.textSecondary,
              }}
            >
              Private beta access. Guara should be configured with encryption, automatic deletion,
              and a no-training-on-customer-data policy before accepting sensitive documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
