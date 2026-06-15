import {
  AlertTriangle,
  Bot,
  Cloud,
  Database,
  Download,
  FileWarning,
  Globe2,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '../Badge';
import { DORA_GAPS } from '../../data/constants';
import { useApp } from '../../contexts/AppContext';
import { theme } from '../../../styles/theme';

type Severity = 'High' | 'Medium' | 'Low';

type FindingCategory =
  | 'DORA'
  | 'Data Residency'
  | 'AI Act'
  | 'Digital Sovereignty'
  | 'Operational Resilience';

const EXTRA_FINDINGS: Array<{
  title: string;
  severity: Severity;
  vendor: string;
  category: FindingCategory;
  article: string;
  rec: string;
}> = [
  {
    title: 'Customer Data Processed Outside EU',
    severity: 'High',
    vendor: 'Snowflake',
    category: 'Data Residency',
    article: 'Residency',
    rec: 'Confirm data processing regions and document cross-border transfer safeguards for regulated customer data.',
  },
  {
    title: 'AI Supplier Not Fully Inventoried',
    severity: 'Medium',
    vendor: 'OpenAI / Azure AI',
    category: 'AI Act',
    article: 'AI Inventory',
    rec: 'Create an AI supplier inventory covering models, use cases, data inputs, and human oversight responsibilities.',
  },
  {
    title: 'Hyperscaler Dependency Exceeds Tolerance',
    severity: 'High',
    vendor: 'AWS',
    category: 'Digital Sovereignty',
    article: 'Concentration',
    rec: 'Assess substitutability and document a mitigation plan for critical cloud dependency.',
  },
  {
    title: 'No Validated Recovery Scenario',
    severity: 'Medium',
    vendor: 'Microsoft Azure',
    category: 'Operational Resilience',
    article: 'Resilience',
    rec: 'Run and document a provider outage simulation for critical services supported by this vendor.',
  },
];

function CategoryIcon({ category }: { category: FindingCategory }) {
  const iconStyle = { color: theme.brand.primary };

  if (category === 'Data Residency') {
    return <Database className="h-4 w-4" style={iconStyle} />;
  }

  if (category === 'AI Act') {
    return <Bot className="h-4 w-4" style={iconStyle} />;
  }

  if (category === 'Digital Sovereignty') {
    return <Globe2 className="h-4 w-4" style={iconStyle} />;
  }

  if (category === 'Operational Resilience') {
    return <Cloud className="h-4 w-4" style={iconStyle} />;
  }

  return <FileWarning className="h-4 w-4" style={iconStyle} />;
}

function categoryStyle(category: FindingCategory): React.CSSProperties {
  if (category === 'DORA') {
    return {
      backgroundColor: theme.brand.primaryLight,
      borderColor: theme.brand.primaryBorder,
      color: theme.brand.primary,
    };
  }

  if (category === 'Data Residency') {
    return {
      backgroundColor: theme.status.infoLight,
      borderColor: theme.status.info,
      color: theme.status.info,
    };
  }

  if (category === 'AI Act') {
    return {
      backgroundColor: theme.neutral.background,
      borderColor: theme.neutral.border,
      color: theme.neutral.textSecondary,
    };
  }

  if (category === 'Digital Sovereignty') {
    return {
      backgroundColor: theme.status.warningLight,
      borderColor: theme.status.warning,
      color: theme.status.warning,
    };
  }

  return {
    backgroundColor: theme.neutral.background,
    borderColor: theme.neutral.border,
    color: theme.neutral.textSecondary,
  };
}

function severityColor(severity: Severity) {
  if (severity === 'High') return theme.status.error;
  if (severity === 'Medium') return theme.status.warning;
  return theme.status.success;
}

export function GapsTab() {
  const { activeScenario } = useApp();

  const doraFindings = DORA_GAPS.map((gap) => ({
    ...gap,
    severity: gap.severity as Severity,
    category: 'DORA' as FindingCategory,
  }));

  const findings = [...doraFindings, ...EXTRA_FINDINGS];

  const highCount = findings.filter((finding) => finding.severity === 'High').length;
  const categories = Array.from(new Set(findings.map((finding) => finding.category)));

  const summaryCards = [
    {
      label: 'Total findings',
      value: findings.length,
      sub: 'Across regulatory and technology risk',
    },
    {
      label: 'High severity',
      value: highCount,
      sub: 'Requires priority remediation',
      warning: true,
    },
    {
      label: 'Risk domains',
      value: categories.length,
      sub: 'DORA, AI, data, sovereignty',
    },
    {
      label: 'Scenario score',
      value: `${activeScenario.readinessScore}/100`,
      sub: 'Audit readiness baseline',
    },
  ];

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: theme.neutral.text,
            }}
          >
            Gap & Risk Analysis
          </h2>

          <p
            style={{
              fontSize: '12px',
              color: theme.neutral.textSecondary,
            }}
            className="mt-0.5"
          >
            {findings.length} findings · {highCount} high severity · {activeScenario.name}
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
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = theme.neutral.background;
            event.currentTarget.style.borderColor = theme.neutral.borderStrong;
            event.currentTarget.style.color = theme.neutral.text;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = theme.neutral.surface;
            event.currentTarget.style.borderColor = theme.neutral.border;
            event.currentTarget.style.color = theme.neutral.textSecondary;
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border p-3 shadow-sm"
            style={{
              backgroundColor: card.warning
                ? theme.status.errorLight
                : theme.neutral.surface,
              borderColor: card.warning
                ? theme.status.error
                : theme.neutral.border,
            }}
          >
            <p
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: card.warning ? theme.status.error : theme.neutral.text,
              }}
            >
              {card.value}
            </p>

            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: theme.neutral.text,
              }}
              className="mt-0.5"
            >
              {card.label}
            </p>

            <p
              style={{
                fontSize: '10px',
                color: theme.neutral.textMuted,
              }}
              className="mt-0.5"
            >
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      <div
        className="mb-4 rounded-2xl border p-4"
        style={{
          backgroundColor: theme.status.warningLight,
          borderColor: theme.status.warning,
        }}
      >
        <div className="flex items-start gap-2">
          <ShieldAlert
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            style={{ color: theme.status.warning }}
          />

          <div>
            <p
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: theme.neutral.text,
              }}
            >
              Priority interpretation
            </p>

            <p
              style={{
                fontSize: '12px',
                lineHeight: 1.55,
                color: theme.neutral.textSecondary,
              }}
            >
              {activeScenario.headlineFinding} {activeScenario.mainRisk}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <span
            key={category}
            className="rounded-full border px-3 py-1"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              ...categoryStyle(category),
            }}
          >
            {category}
          </span>
        ))}
      </div>

      <div className="space-y-2.5">
        {findings.map((finding) => (
          <div
            key={`${finding.title}-${finding.vendor}-${finding.category}`}
            className="rounded-xl border p-4 shadow-sm transition-colors"
            style={{
              backgroundColor: theme.neutral.surface,
              borderColor: theme.neutral.border,
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = theme.neutral.borderStrong;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = theme.neutral.border;
            }}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <div
                  className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: theme.brand.primaryLight }}
                >
                  <CategoryIcon category={finding.category} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: theme.neutral.text,
                      }}
                    >
                      {finding.title}
                    </p>

                    <span
                      className="rounded-full border px-2 py-0.5"
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        ...categoryStyle(finding.category),
                      }}
                    >
                      {finding.category}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: theme.brand.primary,
                    }}
                    className="mt-1"
                  >
                    Vendor: {finding.vendor}
                  </p>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-1.5">
                <span
                  style={{
                    fontSize: '10px',
                    backgroundColor: theme.neutral.background,
                    color: theme.neutral.textMuted,
                  }}
                  className="rounded px-1.5 py-0.5 font-mono"
                >
                  {finding.article}
                </span>

                <Badge level={finding.severity} />
              </div>
            </div>

            <div className="ml-9">
              <div className="mb-2 flex items-center gap-1.5">
                <AlertTriangle
                  className="h-3.5 w-3.5 flex-shrink-0"
                  style={{ color: severityColor(finding.severity) }}
                />

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  Recommended action
                </span>
              </div>

              <p
                style={{
                  fontSize: '12px',
                  lineHeight: 1.6,
                  color: theme.neutral.textSecondary,
                }}
              >
                {finding.rec}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
