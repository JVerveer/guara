import {
  Upload,
  Cpu,
  Network,
  ShieldCheck,
  Cloud,
  Database,
  Brain,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { theme } from '../../styles/theme';

const STEPS = [
  {
    n: '01',
    icon: Upload,
    color: theme.brand.primaryLight,
    iconColor: theme.brand.primary,
    title: 'Start with sample data or upload documents',
    desc: 'Try Guara with a sample risk package first, or upload contracts, vendor lists, questionnaires, SOC reports, ISO certificates, AI policies, data processing agreements, and existing registers.',
  },
  {
    n: '02',
    icon: Cpu,
    color: theme.neutral.background,
    iconColor: theme.status.info,
    title: 'AI extracts your technology dependency map',
    desc: 'Guara reads the documents, identifies vendors, services, data locations, contract terms, evidence, AI providers, cloud providers, and operational dependencies.',
  },
  {
    n: '03',
    icon: Network,
    color: theme.neutral.background,
    iconColor: theme.status.success,
    title: 'Understand concentration and resilience risk',
    desc: 'See where your organization depends on hyperscalers, single providers, external AI tools, critical ICT suppliers, and vendors processing regulated or sensitive data.',
  },
  {
    n: '04',
    icon: ShieldCheck,
    color: theme.neutral.background,
    iconColor: theme.status.warning,
    title: 'Generate regulatory and audit-ready outputs',
    desc: 'Create structured outputs for DORA, AI Act readiness, vendor risk reviews, data residency checks, concentration risk analysis, audit preparation, and board-level reporting.',
  },
];

const DETECTIONS = [
  { icon: Network, label: 'Critical vendor dependencies' },
  { icon: Cloud, label: 'Cloud concentration risk' },
  { icon: Database, label: 'Data residency exposure' },
  { icon: Brain, label: 'AI provider dependency' },
  { icon: AlertTriangle, label: 'Operational resilience gaps' },
  { icon: ShieldCheck, label: 'DORA and AI Act readiness' },
];

const OUTPUTS = [
  'Vendor inventory',
  'Critical supplier register',
  'Technology dependency map',
  'Cloud concentration report',
  'Data residency findings',
  'AI dependency analysis',
  'Missing evidence report',
  'Compliance gap analysis',
  'Audit readiness score',
];

export function HowItWorksPage() {
  const { startSample } = useApp();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
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
            Process
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
            How Guara works
          </h1>

          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: theme.neutral.textSecondary,
            }}
          >
            From scattered vendor documents to a structured view of your technology dependencies,
            concentration risks, data exposure, and regulatory readiness.
          </p>
        </div>

        <div className="space-y-4">
          {STEPS.map(({ n, icon: Icon, color, iconColor, title, desc }) => (
            <div
              key={n}
              className="rounded-2xl border p-5 shadow-sm flex gap-4"
              style={{
                backgroundColor: theme.neutral.surface,
                borderColor: theme.neutral.border,
              }}
            >
              <div className="flex-shrink-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="w-5 h-5" style={{ color: iconColor }} />
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: theme.neutral.textMuted,
                    }}
                    className="font-mono"
                  >
                    {n}
                  </span>

                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: theme.neutral.text,
                    }}
                  >
                    {title}
                  </p>
                </div>

                <p
                  style={{
                    fontSize: '13px',
                    lineHeight: 1.7,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-6 rounded-2xl border p-5 shadow-sm"
          style={{
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
          }}
        >
          <p
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.neutral.text,
            }}
            className="mb-3"
          >
            What Guara detects
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DETECTIONS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: theme.neutral.background,
                  borderColor: theme.neutral.border,
                }}
              >
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: theme.brand.primary }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-4 rounded-2xl border p-5"
          style={{
            backgroundColor: theme.neutral.background,
            borderColor: theme.neutral.border,
          }}
        >
          <p
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.neutral.text,
            }}
            className="mb-3"
          >
            What Guara generates
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OUTPUTS.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: theme.neutral.surface,
                  borderColor: theme.neutral.border,
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: theme.brand.primary }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={startSample}
            className="px-6 py-3 rounded-xl transition-colors"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: theme.brand.primary,
              boxShadow: theme.shadow.brand,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.brand.primaryHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.brand.primary;
            }}
          >
            Try Sample Risk Package →
          </button>
        </div>
      </div>
    </div>
  );
}
