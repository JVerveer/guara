import {
  CheckCircle2,
  FileSearch,
  Loader2,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { PROCESSING_STEPS } from '../data/constants';
import { theme } from '../../styles/theme';

export function ProcessingScreen() {
  const { stepsDone, analysisResult } = useApp();

  const { scenario } = analysisResult;

  const totalMs = PROCESSING_STEPS.reduce((a, step) => a + step.duration, 0);
  const doneSoFar = PROCESSING_STEPS.slice(0, stepsDone).reduce(
    (a, step) => a + step.duration,
    0
  );
  const progress = Math.min(100, Math.round((doneSoFar / totalMs) * 100));
  const activeStep = PROCESSING_STEPS[stepsDone]?.label ?? 'Finalising analysis';

  const visibleDocs = analysisResult.documents.slice(
    0,
    Math.min(analysisResult.documents.length, scenario.documents)
  );

  const packageType = analysisResult.source === 'sample' ? 'sample' : 'uploaded';

  return (
    <div
      className="h-full overflow-hidden"
      style={{ backgroundColor: theme.neutral.background }}
    >
      <div className="flex h-full flex-col items-center justify-center px-4 py-4">
        <div className="w-full max-w-3xl">
          <div className="mb-4 text-center">
            <div
              className="mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1"
              style={{
                backgroundColor: theme.brand.primaryLight,
                borderColor: theme.brand.primaryBorder,
              }}
            >
              <div
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ backgroundColor: theme.brand.primary }}
              />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: theme.brand.primary,
                }}
              >
                {scenario.name} · {scenario.documents} documents ·{' '}
                {scenario.vendors} vendors
              </span>
            </div>

            <h2
              style={{
                fontSize: 'clamp(20px, 3vw, 28px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: theme.neutral.text,
              }}
              className="mb-1"
            >
              Building your technology risk picture
            </h2>

            <p
              style={{
                fontSize: '12px',
                lineHeight: 1.5,
                color: theme.neutral.textSecondary,
              }}
              className="mx-auto max-w-xl"
            >
              Guara is analysing a {packageType} {scenario.industry.toLowerCase()} risk package and
              checking for vendor dependency, concentration, data residency, and regulatory gaps.
            </p>
          </div>

          <div className="mb-3 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
            <div
              className="overflow-hidden rounded-2xl border shadow-sm"
              style={{
                backgroundColor: theme.neutral.surface,
                borderColor: theme.neutral.border,
              }}
            >
              <div
                className="flex items-center justify-between border-b px-4 py-2.5"
                style={{ borderColor: theme.neutral.border }}
              >
                <div className="flex items-center gap-2">
                  <FileSearch
                    className="h-4 w-4"
                    style={{ color: theme.brand.primary }}
                  />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: theme.neutral.text,
                    }}
                  >
                    Documents discovered
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    color: theme.neutral.textMuted,
                  }}
                >
                  {scenario.documents} files
                </span>
              </div>

              <div>
                {visibleDocs.map((doc, index) => {
                  const done = index < stepsDone;
                  const active = index === stepsDone;

                  return (
                    <div
                      key={doc.name}
                      className={`flex items-center gap-2 px-4 py-2 transition-all duration-300 ${
                        done || active ? 'opacity-100' : 'opacity-35'
                      }`}
                      style={{
                        borderTop:
                          index === 0 ? undefined : `1px solid ${theme.neutral.background}`,
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>{doc.icon}</span>

                      <div className="min-w-0 flex-1">
                        <p
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 600,
                            color: theme.neutral.text,
                          }}
                          className="truncate"
                        >
                          {doc.name}
                        </p>
                        <p
                          style={{
                            fontSize: '9.5px',
                            color: theme.neutral.textMuted,
                          }}
                        >
                          {doc.type}
                        </p>
                      </div>

                      {done ? (
                        <CheckCircle2
                          className="h-3.5 w-3.5 flex-shrink-0"
                          style={{ color: theme.status.success }}
                        />
                      ) : active ? (
                        <Loader2
                          className="h-3.5 w-3.5 flex-shrink-0 animate-spin"
                          style={{ color: theme.brand.primary }}
                        />
                      ) : (
                        <div
                          className="h-3.5 w-3.5 flex-shrink-0 rounded-full border"
                          style={{ borderColor: theme.neutral.border }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="relative overflow-hidden rounded-2xl border p-4 shadow-xl"
              style={{
                backgroundColor: theme.sidebar.background,
                borderColor: theme.sidebar.border,
              }}
            >
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl"
                style={{ backgroundColor: theme.sidebar.border }}
              />
              <div
                className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full blur-3xl"
                style={{ backgroundColor: theme.sidebar.activeBackground }}
              />

              <div className="relative mb-3 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: theme.brand.primary }}
                >
                  <Sparkles
                    className="h-4 w-4"
                    style={{ color: theme.sidebar.activeText }}
                  />
                </div>

                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: theme.sidebar.activeText,
                    }}
                  >
                    Guara Analysis Engine
                  </p>
                  <p
                    style={{
                      fontSize: '10px',
                      color: theme.sidebar.textMuted,
                    }}
                  >
                    Current task: {activeStep}
                  </p>
                </div>

                <div className="ml-auto flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full"
                      style={{
                        backgroundColor: theme.brand.primary,
                        animationDelay: `${i * 150}ms`,
                      }}
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
                        done || active ? 'opacity-100' : 'opacity-25'
                      }`}
                      style={{
                        backgroundColor: active
                          ? theme.sidebar.border
                          : 'transparent',
                      }}
                    >
                      <div
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all"
                        style={{
                          backgroundColor: done
                            ? theme.status.success
                            : 'transparent',
                          border: done
                            ? 'none'
                            : active
                              ? `2px solid ${theme.brand.primary}`
                              : `1px solid ${theme.sidebar.textMuted}`,
                        }}
                      >
                        {done && (
                          <CheckCircle2
                            className="h-3.5 w-3.5"
                            style={{ color: theme.sidebar.activeText }}
                          />
                        )}
                        {active && (
                          <div
                            className="h-1.5 w-1.5 animate-pulse rounded-full"
                            style={{ backgroundColor: theme.brand.primary }}
                          />
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '11.5px',
                          color: done
                            ? theme.sidebar.textMuted
                            : active
                              ? theme.sidebar.activeText
                              : theme.sidebar.textMuted,
                          textDecoration: done ? 'line-through' : 'none',
                        }}
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
                    value:
                      stepsDone > 2
                        ? `${scenario.criticalVendors} critical`
                        : 'Queued',
                  },
                  {
                    icon: ShieldCheck,
                    label: 'Readiness',
                    value:
                      stepsDone > 4
                        ? `${scenario.readinessScore}/100`
                        : 'Queued',
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl border p-2"
                    style={{
                      backgroundColor: theme.sidebar.border,
                      borderColor: theme.sidebar.textMuted,
                    }}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{ color: theme.sidebar.text }}
                      />
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: theme.sidebar.activeText,
                        }}
                      >
                        {label}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color:
                          value === 'Queued'
                            ? theme.sidebar.textMuted
                            : theme.sidebar.text,
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border p-3 shadow-sm"
            style={{
              backgroundColor: theme.neutral.surface,
              borderColor: theme.neutral.border,
            }}
          >
            <div className="mb-2 flex justify-between">
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: theme.neutral.textSecondary,
                }}
              >
                Analysis progress
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: theme.neutral.text,
                }}
              >
                {progress}%
              </span>
            </div>

            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: theme.neutral.border }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: theme.brand.primary,
                }}
              />
            </div>

            <p
              style={{
                fontSize: '10.5px',
                color: theme.neutral.textMuted,
              }}
              className="mt-1.5"
            >
              {analysisResult.source === 'sample' ? 'Sample analysis' : 'Uploaded analysis'}:{' '}
              {scenario.headlineFinding}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
