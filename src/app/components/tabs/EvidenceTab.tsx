import {
  AlertTriangle,
  Clock3,
  Download,
  FileCheck,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../Badge';
import { theme } from '../../../styles/theme';
import { useAnalysisResult } from '../../../hooks/useAnalysisResult';
import { evidenceStatusColor, getEvidenceSummary } from '../../../analysis/selectors';

export function EvidenceTab() {
  const analysisResult = useAnalysisResult();
  const { scenario } = analysisResult;
  const summary = getEvidenceSummary(analysisResult);

  const evidenceCategories = [
    {
      label: 'Contracts',
      status: analysisResult.evidence.some((item) => item.type === 'Contract') ? 'Covered' : 'Missing',
      icon: FileCheck,
    },
    {
      label: 'SOC Reports',
      status: analysisResult.evidence.some((item) => item.type === 'SOC Report') ? 'Covered' : 'Missing',
      icon: ShieldCheck,
    },
    {
      label: 'ISO Certificates',
      status: analysisResult.evidence.some((item) => item.type === 'Certificate') ? 'Covered' : 'Missing',
      icon: ShieldCheck,
    },
    {
      label: 'Business Continuity Plans',
      status: analysisResult.evidence.some((item) => item.type === 'BCP') ? 'Covered' : 'Missing',
      icon: AlertTriangle,
    },
    {
      label: 'Exit Strategies',
      status: analysisResult.gaps.some((gap) => gap.title.toLowerCase().includes('exit')) ? 'Missing' : 'Covered',
      icon: AlertTriangle,
    },
  ] as const;

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: theme.neutral.text }}>
            Evidence Coverage
          </h2>
          <p style={{ fontSize: '12px', color: theme.neutral.textSecondary }} className="mt-0.5">
            Supporting evidence for regulatory, vendor, and resilience reviews
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 transition-colors"
          style={{
            fontSize: '12px',
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
            color: theme.neutral.textSecondary,
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div
          className="rounded-xl border p-3 shadow-sm"
          style={{
            backgroundColor: theme.brand.primaryLight,
            borderColor: theme.brand.primaryBorder,
          }}
        >
          <p style={{ fontSize: '22px', fontWeight: 800, color: theme.brand.primary }}>
            {summary.coverage}%
          </p>
          <p style={{ fontSize: '10px', fontWeight: 700, color: theme.neutral.text }}>
            Evidence coverage
          </p>
          <p style={{ fontSize: '10px', color: theme.neutral.textSecondary }}>
            {analysisResult.source === 'sample' ? 'Sample assessment' : 'Uploaded assessment'}
          </p>
        </div>

        {[
          { value: summary.valid, label: 'Valid evidence', description: 'Current and accepted' },
          { value: summary.missing, label: 'Missing items', description: 'Evidence required' },
          { value: summary.expiring, label: 'Expiring soon', description: 'Requires refresh' },
        ].map(({ value, label, description }) => (
          <div
            key={label}
            className="rounded-xl border p-3 shadow-sm"
            style={{
              backgroundColor: theme.neutral.surface,
              borderColor: theme.neutral.border,
            }}
          >
            <p style={{ fontSize: '22px', fontWeight: 800, color: theme.neutral.text }}>
              {value}
            </p>
            <p style={{ fontSize: '10px', fontWeight: 700, color: theme.neutral.text }}>
              {label}
            </p>
            <p style={{ fontSize: '10px', color: theme.neutral.textSecondary }}>{description}</p>
          </div>
        ))}
      </div>

      <div
        className="mb-4 rounded-2xl border p-4 shadow-sm"
        style={{
          backgroundColor: theme.neutral.surface,
          borderColor: theme.neutral.border,
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: theme.neutral.text }}>
              Evidence Coverage Assessment
            </p>
            <p style={{ fontSize: '11px', color: theme.neutral.textSecondary }}>
              What auditors and regulators would expect to see
            </p>
          </div>

          <Badge level={summary.coverage > 80 ? 'Valid' : 'Missing'} />
        </div>

        <div className="space-y-2">
          {evidenceCategories.map(({ label, status, icon: Icon }) => {
            const covered = status === 'Covered';

            return (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border px-3 py-2"
                style={{
                  backgroundColor: theme.neutral.background,
                  borderColor: theme.neutral.border,
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className="h-4 w-4"
                    style={{ color: evidenceStatusColor(status, theme) }}
                  />

                  <span style={{ fontSize: '12px', fontWeight: 600, color: theme.neutral.textSecondary }}>
                    {label}
                  </span>
                </div>

                <span
                  className="rounded-full px-2 py-0.5"
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: covered ? theme.status.successLight : theme.status.warningLight,
                    color: covered ? theme.status.success : theme.status.warning,
                  }}
                >
                  {status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="mb-4 rounded-2xl border p-4"
        style={{
          backgroundColor: theme.status.warningLight,
          borderColor: theme.status.warning,
        }}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: theme.status.warning }} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 800, color: theme.neutral.text }}>
              Evidence observation
            </p>
            <p style={{ fontSize: '12px', lineHeight: 1.55, color: theme.neutral.textSecondary }}>
              {scenario.headlineFinding} Missing documentation around exit planning and resilience evidence would likely be challenged during a formal review.
            </p>
          </div>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-2xl border shadow-sm"
        style={{
          backgroundColor: theme.neutral.surface,
          borderColor: theme.neutral.border,
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr
                className="border-b"
                style={{
                  backgroundColor: theme.neutral.background,
                  borderColor: theme.neutral.border,
                }}
              >
                {['Evidence', 'Vendor', 'Type', 'Status', 'Expires'].map((heading) => (
                  <th key={heading} className="px-4 py-2.5 text-left" style={{ fontSize: '10px', fontWeight: 700 }}>
                    <span className="uppercase tracking-wide" style={{ color: theme.neutral.textMuted }}>
                      {heading}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {analysisResult.evidence.map((item, index) => (
                <tr
                  key={item.name}
                  className="transition-colors"
                  style={{
                    borderBottom:
                      index === analysisResult.evidence.length - 1
                        ? 'none'
                        : `1px solid ${theme.neutral.background}`,
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" style={{ color: theme.brand.primary }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: theme.neutral.text }}>
                        {item.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3" style={{ fontSize: '12px', color: theme.neutral.textSecondary }}>
                    {item.vendor}
                  </td>

                  <td className="px-4 py-3" style={{ fontSize: '12px', color: theme.neutral.textSecondary }}>
                    {item.type}
                  </td>

                  <td className="px-4 py-3">
                    <Badge level={item.status} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" style={{ color: theme.neutral.textMuted }} />
                      <span style={{ fontSize: '12px', color: theme.neutral.textSecondary }}>
                        {item.expires}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="border-t px-4 py-2.5"
          style={{
            backgroundColor: theme.neutral.background,
            borderColor: theme.neutral.border,
          }}
        >
          <span style={{ fontSize: '11px', color: theme.neutral.textMuted }}>
            Showing evidence inventory. Full version includes ownership, collection workflows, expiry monitoring, and audit trails.
          </span>
        </div>
      </div>
    </div>
  );
}
