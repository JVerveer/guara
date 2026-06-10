import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  LockKeyhole,
  Mail,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

type ConversionIntent = 'save' | 'export' | 'upload';

interface ConversionModalProps {
  open: boolean;
  intent?: ConversionIntent;
  onClose: () => void;
}

const INTENT_COPY: Record<
  ConversionIntent,
  {
    icon: typeof Download;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  }
> = {
  save: {
    icon: FileText,
    title: 'Save this analysis',
    description:
      'Create a free account to keep this sample analysis, compare future runs, and upload your own vendor documents next.',
    primaryCta: 'Save Analysis',
    secondaryCta: 'Continue exploring',
  },
  export: {
    icon: Download,
    title: 'Your board pack is ready',
    description:
      'Create a free account to download the generated board and audit package, including the dependency map, evidence summary, and risk findings.',
    primaryCta: 'Download Board Pack',
    secondaryCta: 'Preview first',
  },
  upload: {
    icon: Upload,
    title: 'Analyze your own vendor package',
    description:
      'Upload your own contracts, vendor lists, questionnaires, SOC reports, certificates, and registers to generate a private analysis.',
    primaryCta: 'Start Private Analysis',
    secondaryCta: 'Keep using sample',
  },
};

export function ConversionModal({ open, intent = 'save', onClose }: ConversionModalProps) {
  const { activeScenario } = useApp();

  if (!open) {
    return null;
  }

  const copy = INTENT_COPY[intent];
  const Icon = copy.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-[#94A3B8] transition-colors hover:bg-white hover:text-[#0F172A]"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF6FF]">
            <Icon className="h-5 w-5 text-[#2563EB]" />
          </div>

          <h3
            style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em' }}
            className="mb-2 text-[#0F172A]"
          >
            {copy.title}
          </h3>

          <p style={{ fontSize: '13px', lineHeight: 1.6 }} className="max-w-md text-[#64748B]">
            {copy.description}
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p style={{ fontSize: '13px', fontWeight: 800 }} className="text-[#0F172A]">
                  {activeScenario.name}
                </p>
                <p style={{ fontSize: '11px' }} className="text-[#64748B]">
                  {activeScenario.headlineFinding}
                </p>
              </div>

              <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm">
                <p style={{ fontSize: '18px', fontWeight: 800 }} className="text-[#2563EB]">
                  {activeScenario.readinessScore}
                </p>
                <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#64748B]">
                  score
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white p-2">
                <p style={{ fontSize: '16px', fontWeight: 800 }} className="text-[#0F172A]">
                  {activeScenario.vendors}
                </p>
                <p style={{ fontSize: '10px', fontWeight: 600 }} className="text-[#64748B]">
                  Vendors
                </p>
              </div>

              <div className="rounded-xl bg-white p-2">
                <p style={{ fontSize: '16px', fontWeight: 800 }} className="text-[#0F172A]">
                  {activeScenario.criticalVendors}
                </p>
                <p style={{ fontSize: '10px', fontWeight: 600 }} className="text-[#64748B]">
                  Critical
                </p>
              </div>

              <div className="rounded-xl bg-white p-2">
                <p style={{ fontSize: '16px', fontWeight: 800 }} className="text-[#0F172A]">
                  {activeScenario.documents}
                </p>
                <p style={{ fontSize: '10px', fontWeight: 600 }} className="text-[#64748B]">
                  Docs
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            {[
              'Keep the generated analysis and board-ready output.',
              'Upload your own vendor package when ready.',
              'No credit card required for the private beta.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                <p style={{ fontSize: '12px', lineHeight: 1.5 }} className="text-[#334155]">
                  {item}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-3">
            <label
              htmlFor="conversion-email"
              style={{ fontSize: '11px', fontWeight: 700 }}
              className="mb-1.5 block text-[#334155]"
            >
              Work email
            </label>

            <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#2563EB]">
              <Mail className="h-4 w-4 flex-shrink-0 text-[#94A3B8]" />
              <input
                id="conversion-email"
                type="email"
                placeholder="you@company.com"
                className="w-full bg-transparent text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                style={{ fontSize: '14px' }}
              />
            </div>
          </div>

          <button
            type="button"
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-white shadow-md shadow-blue-200 transition-colors hover:bg-[#1D4ED8]"
            style={{ fontSize: '14px', fontWeight: 800 }}
          >
            {copy.primaryCta}
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl px-4 py-2.5 text-[#64748B] transition-colors hover:bg-[#F8FAFC]"
            style={{ fontSize: '13px', fontWeight: 600 }}
          >
            {copy.secondaryCta}
          </button>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#64748B]" />
            <p style={{ fontSize: '11px', lineHeight: 1.5 }} className="text-[#64748B]">
              Private beta access. Guara should be configured with encryption, automatic deletion,
              and a no-training-on-customer-data policy before accepting sensitive documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
