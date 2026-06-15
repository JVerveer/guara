import {
  Bot,
  Building2,
  Cloud,
  Database,
  Download,
  Globe2,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '../Badge';
import { ALL_VENDORS } from '../../data/constants';
import { useApp } from '../../contexts/AppContext';
import { theme } from '../../../styles/theme';

const VENDOR_META: Record<
  string,
  {
    category: 'Cloud' | 'Payments' | 'Identity' | 'Data' | 'SaaS' | 'AI' | 'Monitoring';
    exposure: 'EU' | 'US' | 'Global';
    dependency: 'Critical' | 'High' | 'Medium' | 'Low';
    dataType: string;
  }
> = {
  AWS: {
    category: 'Cloud',
    exposure: 'US',
    dependency: 'Critical',
    dataType: 'Production workloads',
  },
  Stripe: {
    category: 'Payments',
    exposure: 'US',
    dependency: 'Critical',
    dataType: 'Payment data',
  },
  'Microsoft Azure': {
    category: 'Cloud',
    exposure: 'US',
    dependency: 'Critical',
    dataType: 'Infrastructure data',
  },
  Salesforce: {
    category: 'SaaS',
    exposure: 'US',
    dependency: 'High',
    dataType: 'Customer records',
  },
  Twilio: {
    category: 'SaaS',
    exposure: 'US',
    dependency: 'Medium',
    dataType: 'Communications data',
  },
  Okta: {
    category: 'Identity',
    exposure: 'US',
    dependency: 'Critical',
    dataType: 'Identity data',
  },
  Snowflake: {
    category: 'Data',
    exposure: 'US',
    dependency: 'High',
    dataType: 'Analytics data',
  },
  Datadog: {
    category: 'Monitoring',
    exposure: 'US',
    dependency: 'Medium',
    dataType: 'Telemetry data',
  },
};

function CategoryIcon({ category }: { category: string }) {
  const iconStyle = { color: theme.brand.primary };

  if (category === 'Cloud') {
    return <Cloud className="h-3.5 w-3.5" style={iconStyle} />;
  }

  if (category === 'Payments') {
    return <Globe2 className="h-3.5 w-3.5" style={iconStyle} />;
  }

  if (category === 'Identity') {
    return <KeyRound className="h-3.5 w-3.5" style={iconStyle} />;
  }

  if (category === 'Data') {
    return <Database className="h-3.5 w-3.5" style={iconStyle} />;
  }

  if (category === 'AI') {
    return <Bot className="h-3.5 w-3.5" style={iconStyle} />;
  }

  return <Building2 className="h-3.5 w-3.5" style={iconStyle} />;
}

function ExposureBadge({ exposure }: { exposure: 'EU' | 'US' | 'Global' }) {
  const style: React.CSSProperties =
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

export function VendorsTab() {
  const { activeScenario } = useApp();

  const criticalCount = ALL_VENDORS.filter((vendor) => vendor.criticality === 'Critical').length;
  const usCount = ALL_VENDORS.filter((vendor) => VENDOR_META[vendor.name]?.exposure === 'US').length;
  const cloudCount = ALL_VENDORS.filter((vendor) => VENDOR_META[vendor.name]?.category === 'Cloud').length;

  const summaryCards = [
    {
      label: 'Identified vendors',
      value: activeScenario.vendors,
      sub: `${ALL_VENDORS.length} shown in sample preview`,
    },
    {
      label: 'Critical suppliers',
      value: activeScenario.criticalVendors,
      sub: `${criticalCount} visible in this table`,
      warning: true,
    },
    {
      label: 'US exposure',
      value: usCount,
      sub: 'Visible providers',
    },
    {
      label: 'Cloud providers',
      value: cloudCount,
      sub: 'Infrastructure dependency',
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
            Vendor Intelligence
          </h2>

          <p
            style={{
              fontSize: '12px',
              color: theme.neutral.textSecondary,
            }}
            className="mt-0.5"
          >
            {activeScenario.vendors} vendors identified · {activeScenario.criticalVendors} critical ·{' '}
            {activeScenario.regionExposure}
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
                ? theme.brand.primaryLight
                : theme.neutral.surface,
              borderColor: card.warning
                ? theme.brand.primaryBorder
                : theme.neutral.border,
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
              Vendor exposure insight
            </p>

            <p
              style={{
                fontSize: '12px',
                lineHeight: 1.55,
                color: theme.neutral.textSecondary,
              }}
            >
              {activeScenario.mainRisk}
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
                  <th
                    key={heading}
                    className="px-4 py-2.5 text-left"
                    style={{ fontSize: '10px', fontWeight: 700 }}
                  >
                    <span
                      className="uppercase tracking-wide"
                      style={{ color: theme.neutral.textMuted }}
                    >
                      {heading}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {ALL_VENDORS.map((vendor, index) => {
                const meta = VENDOR_META[vendor.name] ?? {
                  category: 'SaaS' as const,
                  exposure: vendor.country === 'US' ? ('US' as const) : ('Global' as const),
                  dependency: vendor.criticality === 'Critical' ? ('Critical' as const) : ('Medium' as const),
                  dataType: 'Business data',
                };

                return (
                  <tr
                    key={vendor.name}
                    className="transition-colors"
                    style={{
                      borderBottom:
                        index === ALL_VENDORS.length - 1
                          ? 'none'
                          : `1px solid ${theme.neutral.background}`,
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.backgroundColor = theme.neutral.background;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.backgroundColor = theme.neutral.surface;
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: theme.brand.primaryLight }}
                        >
                          <CategoryIcon category={meta.category} />
                        </div>

                        <div>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: theme.neutral.text,
                            }}
                          >
                            {vendor.name}
                          </span>

                          <p
                            style={{
                              fontSize: '10px',
                              color: theme.neutral.textMuted,
                            }}
                          >
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
                        {meta.category}
                      </span>
                    </td>

                    <td className="px-4 py-3" style={{ fontSize: '12px' }}>
                      <span style={{ color: theme.neutral.textSecondary }}>
                        {vendor.service}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <Badge level={vendor.criticality} />
                    </td>

                    <td className="px-4 py-3">
                      <Badge level={vendor.risk} />
                    </td>

                    <td className="px-4 py-3">
                      <Badge level={meta.dependency} />
                    </td>

                    <td className="px-4 py-3">
                      <ExposureBadge exposure={meta.exposure} />
                    </td>

                    <td className="px-4 py-3" style={{ fontSize: '12px' }}>
                      <span style={{ color: theme.neutral.textSecondary }}>
                        {meta.dataType}
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

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: theme.neutral.text,
                          }}
                        >
                          {vendor.score}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3" style={{ fontSize: '12px', fontWeight: 600 }}>
                      <span style={{ color: theme.neutral.text }}>{vendor.spend}</span>
                    </td>
                  </tr>
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
          <span
            style={{
              fontSize: '11px',
              color: theme.neutral.textMuted,
            }}
          >
            Showing {ALL_VENDORS.length} of {activeScenario.vendors} vendors · Create account to
            unlock the full inventory, owner mapping, contract dates, data locations, and
            remediation workflows.
          </span>
        </div>
      </div>
    </div>
  );
}
