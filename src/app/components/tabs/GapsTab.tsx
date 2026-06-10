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

type FindingCategory = 'DORA' | 'Data Residency' | 'AI Act' | 'Digital Sovereignty' | 'Operational Resilience';

const EXTRA_FINDINGS: Array<{
  title: string;
  severity: 'High' | 'Medium' | 'Low';
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
  if (category === 'Data Residency') return <Database className="h-4 w-4 text-[#2563EB]" />;
  if (category === 'AI Act') return <Bot className="h-4 w-4 text-[#2563EB]" />;
  if (category === 'Digital Sovereignty') return <Globe2 className="h-4 w-4 text-[#2563EB]" />;
  if (category === 'Operational Resilience') return <Cloud className="h-4 w-4 text-[#2563EB]" />;
  return <FileWarning className="h-4 w-4 text-[#2563EB]" />;
}

function categoryClasses(category: FindingCategory) {
  if (category === 'DORA') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (category === 'Data Residency') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (category === 'AI Act') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (category === 'Digital Sovereignty') return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function GapsTab() {
  const { activeScenario } = useApp();

  const doraFindings = DORA_GAPS.map((gap) => ({
    ...gap,
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
          <h2 style={{ fontSize: '16px', fontWeight: 700 }} className="text-[#0F172A]">
            Gap & Risk Analysis
          </h2>
          <p style={{ fontSize: '12px' }} className="mt-0.5 text-[#64748B]">
            {findings.length} findings · {highCount} high severity · {activeScenario.name}
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-[#64748B] transition-colors hover:bg-[#F8FAFC]"
          style={{ fontSize: '12px' }}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
            <p style={{ fontSize: '18px', fontWeight: 800 }} className="text-[#0F172A]">
              {card.value}
            </p>
            <p style={{ fontSize: '10px', fontWeight: 700 }} className="mt-0.5 text-[#0F172A]">
              {card.label}
            </p>
            <p style={{ fontSize: '10px' }} className="mt-0.5 text-[#94A3B8]">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#EA580C]" />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 800 }} className="text-[#9A3412]">
              Priority interpretation
            </p>
            <p style={{ fontSize: '12px', lineHeight: 1.55 }} className="text-[#9A3412]">
              {activeScenario.headlineFinding} {activeScenario.mainRisk}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <span
            key={category}
            className={`rounded-full border px-3 py-1 ${categoryClasses(category)}`}
            style={{ fontSize: '11px', fontWeight: 700 }}
          >
            {category}
          </span>
        ))}
      </div>

      <div className="space-y-2.5">
        {findings.map((finding) => (
          <div
            key={`${finding.title}-${finding.vendor}-${finding.category}`}
            className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-colors hover:border-[#CBD5E1]"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF]">
                  <CategoryIcon category={finding.category} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p style={{ fontSize: '13px', fontWeight: 700 }} className="text-[#0F172A]">
                      {finding.title}
                    </p>

                    <span
                      className={`rounded-full border px-2 py-0.5 ${categoryClasses(finding.category)}`}
                      style={{ fontSize: '10px', fontWeight: 700 }}
                    >
                      {finding.category}
                    </span>
                  </div>

                  <p style={{ fontSize: '11px', fontWeight: 600 }} className="mt-1 text-[#2563EB]">
                    Vendor: {finding.vendor}
                  </p>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-1.5">
                <span
                  style={{ fontSize: '10px' }}
                  className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[#94A3B8]"
                >
                  {finding.article}
                </span>
                <Badge level={finding.severity} />
              </div>
            </div>

            <div className="ml-9">
              <div className="mb-2 flex items-center gap-1.5">
                <AlertTriangle
                  className={`h-3.5 w-3.5 flex-shrink-0 ${
                    finding.severity === 'High'
                      ? 'text-red-500'
                      : finding.severity === 'Medium'
                        ? 'text-amber-500'
                        : 'text-green-500'
                  }`}
                />
                <span style={{ fontSize: '11px', fontWeight: 700 }} className="text-[#334155]">
                  Recommended action
                </span>
              </div>

              <p style={{ fontSize: '12px', lineHeight: 1.6 }} className="text-[#64748B]">
                {finding.rec}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
