import {
  Bot,
  Building2,
  Cloud,
  Database,
  Download,
  FileSearch,
  Globe2,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '../Badge';
import { theme } from '../../../styles/theme';
import { useAnalysisResult } from '../../../hooks/useAnalysisResult';
import { getVendorSummary } from '../../../analysis/selectors';
import type { ExposureRegion, Vendor } from '../../../analysis/types';

function CategoryIcon({ category }: { category?: string }) {
  const iconStyle = { color: theme.brand.primary };

  if (category === 'Cloud') return <Cloud className="h-3.5 w-3.5" style={iconStyle} />;
  if (category === 'Payments') return <Globe2 className="h-3.5 w-3.5" style={iconStyle} />;
  if (category === 'Identity') return <KeyRound className="h-3.5 w-3.5" style={iconStyle} />;
  if (category === 'Data') return <Database className="h-3.5 w-3.5" style={iconStyle} />;
  if (category === 'AI') return <Bot className="h-3.5 w-3.5" style={iconStyle} />;

  return <Building2 className="h-3.5 w-3.5" style={iconStyle} />;
}

function ExposureBadge({ exposure }: { exposure: ExposureRegion }) {
  const style =
    exposure === 'EU'
      ? {
          backgroundColor: theme.status.successLight,
          borderColor: theme.status.success,
          color: theme.status.success,
        }
      : exposure === 'US'
        ? {
            backgroundColor: theme.status.warningLight,
            borderColor: theme.status.warning,
            color: theme.status.warning,
          }
        : {
            backgroundColor: theme.status.infoLight,
            borderColor: theme.status.info,
            color: theme.status.info,
          };

  return (
    <span
      className="inline-flex rounded-full border px-2 py-0.5"
      style={{
        fontSize: '10px',
        fontWeight: 700,
        ...style,
      }}
    >
      {exposure}
    </span>
  );
}

function VendorTraceRow({ vendor }: { vendor: Vendor }) {
  const trace = vendor.trace ?? [];

  if (trace.length === 0) {
    return null;
  }

  return (
    <tr>
      <td colSpan={10} className="px-4 pb-3">
        <div
          className="ml-9 rounded-xl border p-3"
          style={{
            backgroundColor: theme.neutral.background,
            borderColor: theme.neutral.border,
          }}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <FileSearch className="h-3.5 w-3.5" style={{ color: theme.brand.primary }} />

            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: theme.neutral.text,
              }}
            >
              Found in source documents
            </span>
          </div>

          <div className="space-y-2">
            {trace.slice(0, 3).map((item, index) => (
              <div
                key={`${item.document}-${item.chunkId ?? index}`}
                className="rounded-lg border p-2"
                style={{
                  backgroundColor: theme.neutral.surface,
                  borderColor: theme.neutral.border,
                }}
              >
                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: theme.brand.primary,
                  }}
                >
                  {item.document}
                  {item.page ? ` · page ${item.page}` : ''} ·{' '}
                  {Math.round(item.confidence * 100)}% confidence
                </p>

                <p
                  className="mt-1"
                  style={{
                    fontSize: '11px',
                    lineHeight: 1.5,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  “{item.excerpt}”
                </p>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

export function VendorsTab() {
  const analysisResult = useAnalysisResult();
  const { scenario } = analysisResult;
  const summary = getVendorSummary(analysisResult);

  const summaryCards = [
    {
      label: 'Identified vendors',
      value: scenario.vendors,
      sub: `${summary.totalVisible} shown in preview`,
    },
    {
      label: 'Critical suppliers',
      value: scenario.criticalVendors,
      sub: `${summary.criticalCount} visible in this table`,
      warning: true,
    },
    {
      label: 'US exposure',
      value: summary.usCount,
      sub: 'Visible providers',
    },
    {
      label: 'Cloud providers',
      value: summary.cloudCount,
      sub: 'Infrastructure dependency',
    },
  ];

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: theme.neutral.text }}>
            Vendor Intelligence
          </h2>
          <p style={{ fontSize: '12px', color: theme.neutral.textSecondary }} className="mt-0.5">
            {scenario.vendors} vendors identified · {scenario.criticalVendors} critical ·{' '}
            {scenario.regionExposure}
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
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border p-3 shadow-sm"
            style={{
              backgroundColor: card.warning ? theme.brand.primaryLight : theme.neutral.surface,
              borderColor: card.warning ? theme.brand.primaryBorder : theme.neutral.border,
            }}
          >
            <p
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: card.warning ? theme.brand.primary : theme.neutral.text,
              }}
            >
              {card.value}
            </p>
            <p style={{ fontSize: '10px', fontWeight: 700, color: theme.neutral.text }} className="mt-0.5">
              {card.label}
            </p>
            <p style={{ fontSize: '10px', color: theme.neutral.textMuted }} className="mt-0.5">
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
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: theme.status.warning }} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 800, color: theme.neutral.text }}>
              Vendor exposure insight
            </p>
            <p style={{ fontSize: '12px', lineHeight: 1.55, color: theme.neutral.textSecondary }}>
              {scenario.mainRisk}
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
          <table className="w-full min-w-[920px]">
            <thead>
              <tr
                className="border-b"
                style={{
                  backgroundColor: theme.neutral.background,
                  borderColor: theme.neutral.border,
                }}
              >
                {[
                  'Vendor',
                  'Category',
                  'Service',
                  'Criticality',
                  'Risk',
                  'Dependency',
                  'Residency',
                  'Data',
                  'Score',
                  'Spend',
                ].map((heading) => (
                  <th key={heading} className="px-4 py-2.5 text-left" style={{ fontSize: '10px', fontWeight: 700 }}>
                    <span className="uppercase tracking-wide" style={{ color: theme.neutral.textMuted }}>
                      {heading}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {analysisResult.vendors.map((vendor, index) => {
                const exposure = vendor.exposure ?? (vendor.country === 'US' ? 'US' : 'Global');
                const isLast = index === analysisResult.vendors.length - 1;

                return (
                  <>
                    <tr
                      key={vendor.name}
                      className="transition-colors"
                      style={{
                        borderBottom:
                          isLast && (!vendor.trace || vendor.trace.length === 0)
                            ? 'none'
                            : `1px solid ${theme.neutral.background}`,
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: theme.brand.primaryLight }}
                          >
                            <CategoryIcon category={vendor.category} />
                          </div>

                          <div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: theme.neutral.text }}>
                              {vendor.name}
                            </span>
                            <p style={{ fontSize: '10px', color: theme.neutral.textMuted }}>
                              {vendor.country} provider
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            backgroundColor: theme.neutral.background,
                            color: theme.neutral.textSecondary,
                          }}
                        >
                          {vendor.category ?? 'SaaS'}
                        </span>
                      </td>

                      <td className="px-4 py-3" style={{ fontSize: '12px' }}>
                        <span style={{ color: theme.neutral.textSecondary }}>{vendor.service}</span>
                      </td>

                      <td className="px-4 py-3">
                        <Badge level={vendor.criticality} />
                      </td>

                      <td className="px-4 py-3">
                        <Badge level={vendor.risk} />
                      </td>

                      <td className="px-4 py-3">
                        <Badge level={vendor.dependency ?? vendor.criticality} />
                      </td>

                      <td className="px-4 py-3">
                        <ExposureBadge exposure={exposure} />
                      </td>

                      <td className="px-4 py-3" style={{ fontSize: '12px' }}>
                        <span style={{ color: theme.neutral.textSecondary }}>
                          {vendor.dataType ?? 'Business data'}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-1.5 w-12 overflow-hidden rounded-full"
                            style={{ backgroundColor: theme.neutral.border }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${vendor.score}%`,
                                backgroundColor: theme.brand.primary,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: theme.neutral.text }}>
                            {vendor.score}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3" style={{ fontSize: '12px', fontWeight: 600 }}>
                        <span style={{ color: theme.neutral.text }}>{vendor.spend}</span>
                      </td>
                    </tr>

                    <VendorTraceRow vendor={vendor} />
                  </>
                );
              })}
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
            Showing {analysisResult.vendors.length} of {scenario.vendors} vendors.
          </span>
        </div>
      </div>
    </div>
  );
}
