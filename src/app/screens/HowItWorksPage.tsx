import { Upload, Cpu, LayoutDashboard, Download } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

const STEPS = [
  {
    n: '01', icon: Upload, color: '#EFF6FF', iconColor: '#2563EB',
    title: 'Upload Documents',
    desc: 'Drop contracts, vendor lists, SOC reports, ISO certificates, questionnaires, or existing DORA registers. PDF, DOCX, XLSX, CSV, and ZIP are all supported. Mix and match — Guara handles any combination.',
  },
  {
    n: '02', icon: Cpu, color: '#F5F3FF', iconColor: '#7C3AED',
    title: 'AI Analyses Everything',
    desc: 'Guara\'s AI reads every document simultaneously. It extracts vendor names, service types, contract terms, expiry dates, evidence references, and maps every piece of data to the DORA framework.',
  },
  {
    n: '03', icon: LayoutDashboard, color: '#F0FDF4', iconColor: '#16A34A',
    title: 'Review Your Programme',
    desc: 'Instantly get a full vendor inventory, ICT third-party register, gap analysis against DORA requirements, concentration risk assessment, evidence library, and audit readiness score.',
  },
  {
    n: '04', icon: Download, color: '#FFF7ED', iconColor: '#EA580C',
    title: 'Export & Audit',
    desc: 'Download regulator-ready reports in PDF or Excel. Your complete audit package — ICT register, gap report, evidence inventory, remediation plan — is generated in one click.',
  },
];

export function HowItWorksPage() {
  const { startSample } = useApp();
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }} className="text-[#2563EB] uppercase mb-2">Process</p>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-[#0F172A] mb-2">How Guara works</h1>
          <p style={{ fontSize: '15px', lineHeight: 1.6 }} className="text-[#64748B]">From raw compliance documents to a complete vendor risk programme in minutes.</p>
        </div>

        <div className="space-y-4">
          {STEPS.map(({ n, icon: Icon, color, iconColor, title, desc }) => (
            <div key={n} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color }}>
                  <Icon className="w-5 h-5" style={{ color: iconColor }} />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span style={{ fontSize: '11px', fontWeight: 700 }} className="text-[#94A3B8] font-mono">{n}</span>
                  <p style={{ fontSize: '15px', fontWeight: 600 }} className="text-[#0F172A]">{title}</p>
                </div>
                <p style={{ fontSize: '13px', lineHeight: 1.7 }} className="text-[#64748B]">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* What Guara generates */}
        <div className="mt-6 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-5">
          <p style={{ fontSize: '14px', fontWeight: 600 }} className="text-[#0F172A] mb-3">What Guara generates</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {['Vendor Inventory', 'Critical Vendor Register', 'DORA ICT Register', 'DORA Gap Analysis', 'Evidence Library', 'Concentration Risk', 'Risk Assessments', 'Audit Readiness Score', 'Audit Package'].map((item) => (
              <div key={item} className="flex items-center gap-2 bg-white rounded-lg border border-[#E2E8F0] px-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] flex-shrink-0" />
                <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#334155]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <button onClick={startSample} className="bg-[#2563EB] text-white px-6 py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors shadow-md shadow-blue-200" style={{ fontSize: '14px', fontWeight: 600 }}>
            Try Sample DORA Package →
          </button>
        </div>
      </div>
    </div>
  );
}
