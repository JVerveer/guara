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
  if (category === 'Cloud') return <Cloud className="h-3.5 w-3.5 text-[#2563EB]" />;
  if (category === 'Payments') return <Globe2 className="h-3.5 w-3.5 text-[#2563EB]" />;
  if (category === 'Identity') return <KeyRound className="h-3.5 w-3.5 text-[#2563EB]" />;
  if (category === 'Data') return <Database className="h-3.5 w-3.5 text-[#2563EB]" />;
  if (category === 'AI') return <Bot className="h-3.5 w-3.5 text-[#2563EB]" />;
  return <Building2 className="h-3.5 w-3.5 text-[#2563EB]" />;
}

function ExposureBadge({ exposure }: { exposure: 'EU' | 'US' | 'Global' }) {
  const classes =
    exposure === 'EU'
      ? 'bg-green-50 text-green-700 border-green-200'
      : exposure === 'US'
        ? 'bg-orange-50 text-orange-700 border-orange-200'
        : 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 ${classes}`}
      style={{ fontSize: '10px', fontWeight: 700 }}
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
          <h2 style={{ fontSize: '16px', fontWeight: 700 }} className="text-[#0F172A]">
            Vendor Intelligence
          </h2>
          <p style={{ fontSize: '12px' }} className="mt-0.5 text-[#64748B]">
            {activeScenario.vendors} vendors identified · {activeScenario.criticalVendors} critical · {activeScenario.regionExposure}
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
              Vendor exposure insight
            </p>
            <p style={{ fontSize: '12px', lineHeight: 1.55 }} className="text-[#9A3412]">
              {activeScenario.mainRisk}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
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
                    <span className="uppercase tracking-wide text-[#94A3B8]">{heading}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {ALL_VENDORS.map((vendor, index) => {
                const meta = VENDOR_META[vendor.name] ?? {
                  category: 'SaaS',
                  exposure: vendor.country === 'US' ? 'US' : 'Global',
                  dependency: vendor.criticality === 'Critical' ? 'Critical' : 'Medium',
                  dataType: 'Business data',
                };

                return (
                  <tr
                    key={vendor.name}
                    className={`border-b border-[#F8FAFC] transition-colors hover:bg-[#F8FAFC] ${
                      index === ALL_VENDORS.length - 1 ? 'border-0' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF]">
                          <CategoryIcon category={meta.category} />
                        </div>

                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 700 }} className="text-[#0F172A]">
                            {vendor.name}
                          </span>
                          <p style={{ fontSize: '10px' }} className="text-[#94A3B8]">
                            {vendor.country} provider
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[#64748B]"
                        style={{ fontSize: '10px', fontWeight: 700 }}
                      >
                        {meta.category}
                      </span>
                    </td>

                    <td className="px-4 py-3" style={{ fontSize: '12px' }}>
                      <span className="text-[#64748B]">{vendor.service}</span>
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
                      <span className="text-[#64748B]">{meta.dataType}</span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[#E2E8F0]">
                          <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${vendor.score}%` }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600 }} className="text-[#0F172A]">
                          {vendor.score}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3" style={{ fontSize: '12px', fontWeight: 600 }}>
                      <span className="text-[#0F172A]">{vendor.spend}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2.5">
          <span style={{ fontSize: '11px' }} className="text-[#94A3B8]">
            Showing {ALL_VENDORS.length} of {activeScenario.vendors} vendors · Create account to unlock the full inventory,
            owner mapping, contract dates, data locations, and remediation workflows.
          </span>
        </div>
      </div>
    </div>
  );
}
