import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../Badge';
import { EVIDENCE_ITEMS } from '../../data/constants';
import { useApp } from '../../contexts/AppContext';

export function EvidenceTab() {
  const { activeScenario } = useApp();

  const valid = EVIDENCE_ITEMS.filter((item) => item.status === 'Valid').length;
  const missing = EVIDENCE_ITEMS.filter((item) => item.status === 'Missing').length;
  const expiring = EVIDENCE_ITEMS.filter((item) => item.status === 'Expiring').length;

  const coverage = Math.round((valid / EVIDENCE_ITEMS.length) * 100);

  const evidenceCategories = [
    {
      label: 'Contracts',
      status: 'Covered',
      icon: FileCheck,
    },
    {
      label: 'SOC Reports',
      status: 'Covered',
      icon: ShieldCheck,
    },
    {
      label: 'ISO Certificates',
      status: 'Covered',
      icon: ShieldCheck,
    },
    {
      label: 'Business Continuity Plans',
      status: 'Missing',
      icon: AlertTriangle,
    },
    {
      label: 'Exit Strategies',
      status: 'Missing',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }} className="text-[#0F172A]">
            Evidence Coverage
          </h2>
          <p style={{ fontSize: '12px' }} className="mt-0.5 text-[#64748B]">
            Supporting evidence for regulatory, vendor, and resilience reviews
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
        <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3 shadow-sm">
          <p style={{ fontSize: '22px', fontWeight: 800 }} className="text-[#2563EB]">
            {coverage}%
          </p>
          <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#0F172A]">
            Evidence coverage
          </p>
          <p style={{ fontSize: '10px' }} className="text-[#64748B]">
            Sample assessment
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
          <p style={{ fontSize: '22px', fontWeight: 800 }} className="text-[#0F172A]">
            {valid}
          </p>
          <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#0F172A]">
            Valid evidence
          </p>
          <p style={{ fontSize: '10px' }} className="text-[#64748B]">
            Current and accepted
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
          <p style={{ fontSize: '22px', fontWeight: 800 }} className="text-[#0F172A]">
            {missing}
          </p>
          <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#0F172A]">
            Missing items
          </p>
          <p style={{ fontSize: '10px' }} className="text-[#64748B]">
            Evidence required
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
          <p style={{ fontSize: '22px', fontWeight: 800 }} className="text-[#0F172A]">
            {expiring}
          </p>
          <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#0F172A]">
            Expiring soon
          </p>
          <p style={{ fontSize: '10px' }} className="text-[#64748B]">
            Requires refresh
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700 }} className="text-[#0F172A]">
              Evidence Coverage Assessment
            </p>
            <p style={{ fontSize: '11px' }} className="text-[#64748B]">
              What auditors and regulators would expect to see
            </p>
          </div>

          <Badge level={coverage > 80 ? 'Valid' : 'Missing'} />
        </div>

        <div className="space-y-2">
          {evidenceCategories.map(({ label, status, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={`h-4 w-4 ${
                    status === 'Covered' ? 'text-green-600' : 'text-orange-500'
                  }`}
                />
                <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#334155]">
                  {label}
                </span>
              </div>

              <span
                className={`rounded-full px-2 py-0.5 ${
                  status === 'Covered'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-orange-50 text-orange-700'
                }`}
                style={{ fontSize: '10px', fontWeight: 700 }}
              >
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#EA580C]" />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 800 }} className="text-[#9A3412]">
              Evidence observation
            </p>
            <p style={{ fontSize: '12px', lineHeight: 1.55 }} className="text-[#9A3412]">
              {activeScenario.headlineFinding} Missing documentation around exit planning and
              resilience evidence would likely be challenged during a formal review.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                {['Evidence', 'Vendor', 'Type', 'Status', 'Expires'].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-2.5 text-left"
                    style={{ fontSize: '10px', fontWeight: 700 }}
                  >
                    <span className="uppercase tracking-wide text-[#94A3B8]">
                      {heading}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {EVIDENCE_ITEMS.map((item, index) => (
                <tr
                  key={item.name}
                  className={`border-b border-[#F8FAFC] transition-colors hover:bg-[#F8FAFC] ${
                    index === EVIDENCE_ITEMS.length - 1 ? 'border-0' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-[#2563EB]" />
                      <span
                        style={{ fontSize: '12px', fontWeight: 600 }}
                        className="text-[#0F172A]"
                      >
                        {item.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3" style={{ fontSize: '12px' }}>
                    <span className="text-[#64748B]">{item.vendor}</span>
                  </td>

                  <td className="px-4 py-3" style={{ fontSize: '12px' }}>
                    <span className="text-[#64748B]">{item.type}</span>
                  </td>

                  <td className="px-4 py-3">
                    <Badge level={item.status} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5 text-[#94A3B8]" />
                      <span style={{ fontSize: '12px' }} className="text-[#64748B]">
                        {item.expires}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2.5">
          <span style={{ fontSize: '11px' }} className="text-[#94A3B8]">
            Showing sample evidence inventory. Full version includes ownership,
            collection workflows, expiry monitoring, and audit trails.
          </span>
        </div>
      </div>
    </div>
  );
}
