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

const STEPS = [
  {
    n: '01',
    icon: Upload,
    color: '#EFF6FF',
    iconColor: '#2563EB',
    title: 'Start with sample data or upload documents',
    desc: 'Try Guara with a sample risk package first, or upload contracts, vendor lists, questionnaires, SOC reports, ISO certificates, AI policies, data processing agreements, and existing registers.',
  },
  {
    n: '02',
    icon: Cpu,
    color: '#F5F3FF',
    iconColor: '#7C3AED',
    title: 'AI extracts your technology dependency map',
    desc: 'Guara reads the documents, identifies vendors, services, data locations, contract terms, evidence, AI providers, cloud providers, and operational dependencies.',
  },
  {
    n: '03',
    icon: Network,
    color: '#F0FDF4',
    iconColor: '#16A34A',
    title: 'Understand concentration and resilience risk',
    desc: 'See where your organization depends on hyperscalers, single providers, external AI tools, critical ICT suppliers, and vendors processing regulated or sensitive data.',
  },
  {
    n: '04',
    icon: ShieldCheck,
    color: '#FFF7ED',
    iconColor: '#EA580C',
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
            style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}
            className="text-[#2563EB] uppercase mb-2"
          >
            Process
          </p>

          <h1
            style={{
              fontSize: 'clamp(22px, 3vw, 30px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
            className="text-[#0F172A] mb-2"
          >
            How Guara works
          </h1>

          <p style={{ fontSize: '15px', lineHeight: 1.6 }} className="text-[#64748B]">
            From scattered vendor documents to a structured view of your technology dependencies,
            concentration risks, data exposure, and regulatory readiness.
          </p>
        </div>

        <div className="space-y-4">
          {STEPS.map(({ n, icon: Icon, color, iconColor, title, desc }) => (
            <div
              key={n}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm flex gap-4"
            >
              <div className="flex-shrink-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: color }}
                >
                  <Icon className="w-5 h-5" style={{ color: iconColor }} />
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    style={{ fontSize: '11px', fontWeight: 700 }}
                    className="text-[#94A3B8] font-mono"
                  >
                    {n}
                  </span>

                  <p style={{ fontSize: '15px', fontWeight: 600 }} className="text-[#0F172A]">
                    {title}
                  </p>
                </div>

                <p style={{ fontSize: '13px', lineHeight: 1.7 }} className="text-[#64748B]">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
          <p style={{ fontSize: '14px', fontWeight: 600 }} className="text-[#0F172A] mb-3">
            What Guara detects
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DETECTIONS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] px-3 py-2"
              >
                <Icon className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#334155]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-5">
          <p style={{ fontSize: '14px', fontWeight: 600 }} className="text-[#0F172A] mb-3">
            What Guara generates
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OUTPUTS.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 bg-white rounded-lg border border-[#E2E8F0] px-3 py-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] flex-shrink-0" />
                <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#334155]">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={startSample}
            className="bg-[#2563EB] text-white px-6 py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors shadow-md shadow-blue-200"
            style={{ fontSize: '14px', fontWeight: 600 }}
          >
            Try Sample Risk Package →
          </button>
        </div>
      </div>
    </div>
  );
}