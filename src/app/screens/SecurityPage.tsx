import {
  Lock,
  Shield,
  Trash2,
  Award,
  Eye,
  CheckCircle2,
  Server,
  Globe,
} from 'lucide-react';
import { theme } from '../../styles/theme';

const POINTS = [
  {
    icon: Lock,
    title: 'Encrypted in transit',
    desc: 'All data is transferred over TLS 1.3. Nothing leaves your browser unencrypted.',
    tag: 'Transport',
  },
  {
    icon: Shield,
    title: 'Encrypted at rest',
    desc: 'Documents are stored with AES-256 encryption. Keys are managed per-tenant.',
    tag: 'Storage',
  },
  {
    icon: Trash2,
    title: 'Automatic deletion',
    desc: 'Set documents to auto-delete immediately after analysis, or on a custom schedule.',
    tag: 'Retention',
  },
  {
    icon: Award,
    title: 'SOC2-ready architecture',
    desc: 'Our infrastructure is built on SOC 2 Type II compliant cloud services.',
    tag: 'Compliance',
  },
  {
    icon: Eye,
    title: 'No model training',
    desc: 'Your documents are never used to train AI models. Your data is yours.',
    tag: 'Privacy',
  },
  {
    icon: CheckCircle2,
    title: 'Enterprise access control',
    desc: 'Role-based permissions and full audit logs on every action.',
    tag: 'Access',
  },
  {
    icon: Server,
    title: 'EU data residency',
    desc: 'Choose to keep all data within the EU. Supports GDPR and data sovereignty requirements.',
    tag: 'Residency',
  },
  {
    icon: Globe,
    title: 'Zero-trust architecture',
    desc: 'Every request is authenticated and authorised independently. No implicit trust.',
    tag: 'Architecture',
  },
];

export function SecurityPage() {
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
            Trust & security
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
            Your documents stay secure
          </h1>

          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: theme.neutral.textSecondary,
            }}
          >
            Guara is built for regulated industries. We treat your compliance documents with the
            same care your regulators expect.
          </p>
        </div>

        <div
          className="rounded-2xl p-5 mb-5 flex items-center justify-between"
          style={{
            backgroundColor: theme.sidebar.background,
            border: `1px solid ${theme.sidebar.border}`,
            boxShadow: theme.shadow.card,
          }}
        >
          <div>
            <p
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: theme.sidebar.activeText,
              }}
              className="mb-0.5"
            >
              Security posture
            </p>

            <p
              style={{
                fontSize: '12px',
                color: theme.sidebar.textMuted,
              }}
            >
              Enterprise-grade across all layers
            </p>
          </div>

          <div className="text-right">
            <p
              style={{
                fontSize: '28px',
                fontWeight: 800,
                color: theme.status.success,
              }}
            >
              A+
            </p>

            <p
              style={{
                fontSize: '11px',
                color: theme.sidebar.textMuted,
              }}
            >
              Rating
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {POINTS.map(({ icon: Icon, title, desc, tag }) => (
            <div
              key={title}
              className="rounded-xl border p-4 shadow-sm"
              style={{
                backgroundColor: theme.neutral.surface,
                borderColor: theme.neutral.border,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: theme.brand.primaryLight }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: theme.brand.primary }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: theme.neutral.text,
                      }}
                    >
                      {title}
                    </p>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        backgroundColor: theme.neutral.background,
                        color: theme.neutral.textSecondary,
                      }}
                      className="px-1.5 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '12px',
                      lineHeight: 1.6,
                      color: theme.neutral.textSecondary,
                    }}
                  >
                    {desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-5 rounded-xl border p-4 flex items-start gap-3"
          style={{
            backgroundColor: theme.status.successLight,
            borderColor: theme.status.success,
          }}
        >
          <CheckCircle2
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            style={{ color: theme.status.success }}
          />

          <p
            style={{
              fontSize: '13px',
              lineHeight: 1.6,
              color: theme.neutral.text,
            }}
          >
            <strong>For regulated financial institutions:</strong> Guara&apos;s data handling meets
            the requirements of DORA, GDPR, and major EU financial supervisory frameworks. Security
            documentation is available on request.
          </p>
        </div>
      </div>
    </div>
  );
}
