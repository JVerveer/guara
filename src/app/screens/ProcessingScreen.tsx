import {
  CheckCircle2,
  FileSearch,
  Loader2,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { PROCESSING_STEPS, SAMPLE_DOCS } from '../data/constants';

export function ProcessingScreen() {
  const { stepsDone, activeScenario } = useApp();

  const totalMs = PROCESSING_STEPS.reduce((a, step) => a + step.duration, 0);
  const doneSoFar = PROCESSING_STEPS.slice(0, stepsDone).reduce((a, step) => a + step.duration, 0);
  const progress = Math.min(100, Math.round((doneSoFar / totalMs) * 100));
  const activeStep = PROCESSING_STEPS[stepsDone]?.label ?? 'Finalising analysis';

  const visibleDocs = SAMPLE_DOCS.slice(0, Math.min(SAMPLE_DOCS.length, activeScenario.documents));

  return (
    <div className="h-full overflow-hidden bg-[#F8FAFC]">
      <div className="flex h-full flex-col items-center justify-center px-4 py-4">
        <div className="w-full max-w-3xl">
          <div className="mb-4 text-center">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2563EB]" />
              <span style={{ fontSize: '11px', fontWeight: 600 }} className="text-[#2563EB]">
                {activeScenario.name} · {activeScenario.documents} documents · {activeScenario.vendors} vendors
              </span>
            </div>

            <h2
              style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.03em' }}
              className="mb-1 text-[#0F172A]"
            >
              Building your technology risk picture
            </h2>

            <p style={{ fontSize: '12px', lineHeight: 1.5 }} className="mx-auto max-w-xl text-[#64748B]">
              Guara is analysing a sample {activeScenario.industry.toLowerCase()} risk package and checking for
              vendor dependency, concentration, data residency, and regulatory gaps.
            </p>
          </div>

          <div className="mb-3 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-[#2563EB]" />
                  <span style={{ fontSize: '12px', fontWeight: 700 }} className="text-[#0F172A]">
                    Documents discovered
                  </span>
                </div>

                <span style={{ fontSize: '11px' }} className="text-[#94A3B8]">
                  {activeScenario.documents} files
                </span>
              </div>

              <div className="divide-y divide-[#F8FAFC]">
                {visibleDocs.map((doc, index) => {
                  const done = index < stepsDone;
                  const active = index === stepsDone;

                  return (
                    <div
                      key={doc.name}
                      className={`flex items-center gap-2 px-4 py-2 transition-all duration-300 ${
                        done || active ? 'opacity-100' : 'opacity-35'
                      }`}
                    >
                      <span style={{ fontSize: '14px' }}>{doc.icon}</span>

                      <div className="min-w-0 flex-1">
                        <p style={{ fontSize: '10.5px', fontWeight: 600 }} className="truncate text-[#0F172A]">
                          {doc.name}
                        </p>
                        <p style={{ fontSize: '9.5px' }} className="text-[#94A3B8]">
                          {doc.type}
                        </p>
                      </div>

                      {done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                      ) : active ? (
                        <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-[#2563EB]" />
                      ) : (
                        <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full border border-[#E2E8F0]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-[#1E293B] bg-[#0F172A] p-4 shadow-xl">
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#2563EB]/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[#7C3AED]/20 blur-3xl" />

              <div className="relative mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#2563EB]">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>

                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700 }} className="text-white">
                    Guara Analysis Engine
                  </p>
                  <p style={{ fontSize: '10px' }} className="text-slate-400">
                    Current task: {activeStep}
                  </p>
                </div>

                <div className="ml-auto flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3B82F6]"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>

              <div className="relative space-y-1.5">
                {PROCESSING_STEPS.map((step, index) => {
                  const done = index < stepsDone;
                  const active = index === stepsDone;

                  return (
                    <div
                      key={step.label}
                      className={`flex items-center gap-2.5 rounded-xl px-2 py-1 transition-all duration-300 ${
                        active ? 'bg-white/5' : ''
                      } ${done || active ? 'opacity-100' : 'opacity-25'}`}
                    >
                      <div
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                          done
                            ? 'bg-green-500'
                            : active
                              ? 'border-2 border-[#3B82F6]'
                              : 'border border-slate-600'
                        }`}
                      >
                        {done && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        {active && <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3B82F6]" />}
                      </div>

                      <span
                        style={{ fontSize: '11.5px' }}
                        className={
                          done
                            ? 'text-slate-500 line-through'
                            : active
                              ? 'text-white'
                              : 'text-slate-600'
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="relative mt-4 grid grid-cols-2 gap-2">
                {[
                  {
                    icon: Network,
                    label: 'Dependencies',
                    value: stepsDone > 2 ? `${activeScenario.criticalVendors} critical` : 'Queued',
                  },
                  {
                    icon: ShieldCheck,
                    label: 'Readiness',
                    value: stepsDone > 4 ? `${activeScenario.readinessScore}/100` : 'Queued',
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-2">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-[#93C5FD]" />
                      <span style={{ fontSize: '10.5px', fontWeight: 700 }} className="text-white">
                        {label}
                      </span>
                    </div>

                    <span
                      style={{ fontSize: '10px', fontWeight: 600 }}
                      className={value === 'Queued' ? 'text-slate-500' : 'text-[#93C5FD]'}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
            <div className="mb-2 flex justify-between">
              <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#64748B]">
                Analysis progress
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800 }} className="text-[#0F172A]">
                {progress}%
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
              <div
                className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p style={{ fontSize: '10.5px' }} className="mt-1.5 text-[#94A3B8]">
              Sample analysis: {activeScenario.headlineFinding}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
