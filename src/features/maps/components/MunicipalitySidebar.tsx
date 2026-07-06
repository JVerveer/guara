import { BarChart3, Database, FileText, Lightbulb } from "lucide-react";
import type { Municipality, MunicipalityMetadata } from "@/features/maps/types";

interface MunicipalitySidebarProps {
  municipality: Municipality | null;
  metadata?: MunicipalityMetadata;
  formatNumber: (value: number) => string;
  formatCurrency: (value: number) => string;
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-5">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

export function MunicipalitySidebar({ municipality, metadata, formatNumber, formatCurrency }: MunicipalitySidebarProps) {
  return (
    <aside className="w-[340px] flex-shrink-0 overflow-y-auto border-l border-border bg-card transition-transform duration-300">
      {!municipality || !metadata ? (
        <div className="flex h-full flex-col justify-center px-8 text-center">
          <p className="text-sm font-medium text-foreground">Select a municipality</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Inspect statistics, evidence, datasets, and AI suggested research paths.
          </p>
        </div>
      ) : (
        <div className="space-y-6 p-6">
          <header>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{municipality.province}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{municipality.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">CBS code {municipality.cbsCode}</p>
          </header>

          <Section icon={<BarChart3 size={14} aria-hidden="true" />} title="Quick statistics">
            <dl className="grid grid-cols-2 gap-3">
              {[
                ["Population", formatNumber(metadata.population)],
                ["65+ share", `${metadata.medianAge.toFixed(1)}%`],
                ["House price", formatCurrency(metadata.housePrice)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted p-3">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section icon={<Database size={14} aria-hidden="true" />} title="Related datasets">
            <ul className="space-y-2">
              {metadata.relatedDatasets.map((dataset) => (
                <li key={dataset} className="rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                  {dataset}
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={<FileText size={14} aria-hidden="true" />} title="Evidence">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {metadata.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>

          {metadata.recentResearch.length > 0 && (
            <Section icon={<FileText size={14} aria-hidden="true" />} title="Recent research">
              <ul className="space-y-2 text-sm text-foreground">
                {metadata.recentResearch.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section icon={<Lightbulb size={14} aria-hidden="true" />} title="AI suggested questions">
            <div className="space-y-2">
              {metadata.suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="w-full rounded-lg bg-accent px-3 py-2 text-left text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/75"
                >
                  {question}
                </button>
              ))}
            </div>
          </Section>
        </div>
      )}
    </aside>
  );
}
