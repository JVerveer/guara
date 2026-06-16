import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { theme } from '../styles/theme';
import type { RiskReportData } from './buildRiskReportData';
import type { FindingTrace } from '../analysis/types';

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: theme.neutral.text,
    backgroundColor: theme.neutral.surface,
  },
  cover: {
    backgroundColor: theme.sidebar.background,
    color: theme.sidebar.activeText,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.brand.primary,
    marginBottom: 8,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: -1,
    marginBottom: 12,
    color: theme.sidebar.activeText,
  },
  coverSubtitle: {
    fontSize: 12,
    lineHeight: 1.6,
    color: theme.sidebar.text,
    marginBottom: 28,
    maxWidth: 420,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 6,
    color: theme.neutral.text,
  },
  subtitle: {
    fontSize: 10,
    lineHeight: 1.5,
    color: theme.neutral.textSecondary,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: theme.neutral.text,
    marginBottom: 8,
  },
  card: {
    border: `1px solid ${theme.neutral.border}`,
    borderRadius: 10,
    padding: 12,
    backgroundColor: theme.neutral.surface,
    marginBottom: 10,
  },
  highlightedCard: {
    border: `1px solid ${theme.brand.primaryBorder}`,
    borderRadius: 10,
    padding: 12,
    backgroundColor: theme.brand.primaryLight,
    marginBottom: 10,
  },
  warningCard: {
    border: `1px solid ${theme.status.warning}`,
    borderRadius: 10,
    padding: 12,
    backgroundColor: theme.status.warningLight,
    marginBottom: 10,
  },
  successCard: {
    border: `1px solid ${theme.status.success}`,
    borderRadius: 10,
    padding: 12,
    backgroundColor: theme.status.successLight,
    marginBottom: 10,
  },
  traceCard: {
    marginTop: 7,
    padding: 8,
    borderRadius: 6,
    backgroundColor: theme.neutral.background,
    border: `1px solid ${theme.neutral.border}`,
  },
  traceTitle: {
    fontSize: 8,
    fontWeight: 800,
    color: theme.brand.primary,
    marginBottom: 3,
  },
  traceText: {
    fontSize: 8,
    lineHeight: 1.4,
    color: theme.neutral.textSecondary,
  },
  traceLabel: {
    fontSize: 8,
    fontWeight: 800,
    color: theme.neutral.text,
    marginTop: 6,
    marginBottom: 3,
  },
  grid: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 800,
    color: theme.neutral.text,
    marginBottom: 3,
  },
  metricValueBrand: {
    fontSize: 20,
    fontWeight: 800,
    color: theme.brand.primary,
    marginBottom: 3,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: 800,
    color: theme.neutral.text,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  muted: {
    color: theme.neutral.textMuted,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.55,
    color: theme.neutral.textSecondary,
  },
  strong: {
    fontWeight: 800,
    color: theme.neutral.text,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: `1px solid ${theme.neutral.background}`,
    paddingVertical: 7,
    gap: 8,
  },
  rowStack: {
    borderBottom: `1px solid ${theme.neutral.background}`,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  rowHeader: {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: `1px solid ${theme.neutral.border}`,
    backgroundColor: theme.neutral.background,
    paddingVertical: 7,
    paddingHorizontal: 6,
    gap: 8,
  },
  table: {
    border: `1px solid ${theme.neutral.border}`,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 14,
  },
  th: {
    fontSize: 8,
    fontWeight: 800,
    color: theme.neutral.textMuted,
    textTransform: 'uppercase',
  },
  td: {
    fontSize: 9,
    color: theme.neutral.textSecondary,
  },
  colLarge: {
    flex: 2,
  },
  col: {
    flex: 1,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 7,
    fontSize: 8,
    fontWeight: 800,
    alignSelf: 'flex-start',
  },
  badgeHigh: {
    backgroundColor: theme.status.errorLight,
    color: theme.status.error,
  },
  badgeMedium: {
    backgroundColor: theme.status.warningLight,
    color: theme.status.warning,
  },
  badgeLow: {
    backgroundColor: theme.status.successLight,
    color: theme.status.success,
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.neutral.border,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.brand.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    fontSize: 8,
    color: theme.neutral.textMuted,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `1px solid ${theme.neutral.border}`,
    paddingTop: 8,
  },
});

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(iso));
}

function SeverityBadge({ level }: { level: string }) {
  const style =
    level === 'High' || level === 'Critical' || level === 'Severe' || level === 'Missing'
      ? styles.badgeHigh
      : level === 'Medium' || level === 'Expiring'
        ? styles.badgeMedium
        : styles.badgeLow;

  return <Text style={[styles.badge, style]}>{level}</Text>;
}

function Footer({ data }: { data: RiskReportData }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Guara Risk Report · {data.scenario.name}</Text>
      <Text>Generated {formatDate(data.generatedAt)}</Text>
    </View>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <View style={highlight ? styles.highlightedCard : styles.card}>
      <Text style={highlight ? styles.metricValueBrand : styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.td, styles.muted]}>{sub}</Text>
    </View>
  );
}

function PageTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function TraceEvidenceBlock({
  trace,
  title = 'Evidence source',
  limit = 2,
}: {
  trace?: FindingTrace[];
  title?: string;
  limit?: number;
}) {
  if (!trace || trace.length === 0) {
    return null;
  }

  return (
    <View style={styles.traceCard}>
      <Text style={styles.traceLabel}>{title}</Text>

      {trace.slice(0, limit).map((item, index) => (
        <View key={`${item.document}-${item.chunkId ?? index}`} style={{ marginBottom: index === trace.length - 1 ? 0 : 6 }}>
          <Text style={styles.traceTitle}>
            {item.document}
            {item.page ? ` · page ${item.page}` : ''} · {Math.round(item.confidence * 100)}% confidence
          </Text>

          <Text style={styles.traceText}>“{item.excerpt}”</Text>
        </View>
      ))}
    </View>
  );
}

export function RiskReportPdf({ data }: { data: RiskReportData }) {
  const { scenario } = data;

  return (
    <Document
      title={`Guara Risk Report - ${scenario.name}`}
      author="Guara"
      subject="Vendor risk, DORA, evidence, concentration, and audit readiness report"
    >
      <Page size="A4" style={[styles.page, styles.cover]}>
        <Text style={styles.eyebrow}>Guara Risk Intelligence</Text>
        <Text style={styles.coverTitle}>Board & Audit Risk Report</Text>
        <Text style={styles.coverSubtitle}>
          Generated analysis for {scenario.name}. This report summarises vendor dependency,
          concentration risk, evidence coverage, DORA gaps, digital sovereignty exposure, and
          audit-ready outputs.
        </Text>

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <MetricCard label="Readiness" value={`${scenario.readinessScore}/100`} sub="Audit baseline" highlight />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="Vendors" value={scenario.vendors} sub={`${scenario.criticalVendors} critical`} />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="Documents" value={scenario.documents} sub="Analysed package" />
          </View>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.sectionTitle}>Priority interpretation</Text>
          <Text style={styles.body}>{scenario.headlineFinding} {scenario.mainRisk}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Digital sovereignty exposure</Text>
          <Text style={styles.body}>{scenario.regionExposure}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Traceability coverage</Text>
          <Text style={styles.body}>
            {data.traceability.findingsWithTrace}/{data.gaps.findings.length} findings,{' '}
            {data.traceability.vendorsWithTrace}/{data.vendors.all.length} vendors, and{' '}
            {data.traceability.evidenceWithTrace}/{data.evidence.items.length} evidence items include source traceability.
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <PageTitle
          eyebrow="Overview"
          title="Executive summary"
          subtitle="High-level view of the scenario, core metrics, and board-level risk interpretation."
        />

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <MetricCard label="Readiness" value={`${scenario.readinessScore}/100`} sub="Audit-ready output" highlight />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="Sovereignty" value={`${data.overview.sovereigntyScore}/100`} sub={scenario.regionExposure} />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="Traceable findings" value={data.traceability.findingsWithTrace} sub={`${data.traceability.totalFindingTraces} source links`} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>AI Executive Summary</Text>
          {[
            `Analysed ${scenario.documents} documents for a ${scenario.industry.toLowerCase()} scenario covering ${scenario.vendors} vendors.`,
            `${scenario.criticalVendors} critical vendors identified across technology, data, infrastructure, and operational services.`,
            scenario.headlineFinding,
            scenario.mainRisk,
            `Digital sovereignty exposure: ${scenario.regionExposure}.`,
          ].map((line) => (
            <Text key={line} style={styles.body}>• {line}</Text>
          ))}
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.sectionTitle}>Board-level priority risks</Text>
          {data.audit.recommendations.map((item, index) => (
            <Text key={item} style={styles.body}>{index + 1}. {item}</Text>
          ))}
        </View>

        <Footer data={data} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageTitle
          eyebrow="Vendor intelligence"
          title="Vendor inventory"
          subtitle={`${scenario.vendors} vendors identified. This preview shows ${data.vendors.all.length} sample vendors and their risk attributes.`}
        />

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <MetricCard label="Critical suppliers" value={scenario.criticalVendors} sub={`${data.vendors.criticalCount} visible in sample`} highlight />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="Shown vendors" value={data.vendors.all.length} sub="Sample preview" />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="Traceable vendors" value={data.traceability.vendorsWithTrace} sub={`${data.traceability.totalVendorTraces} source links`} />
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.rowHeader}>
            <Text style={[styles.th, styles.colLarge]}>Vendor</Text>
            <Text style={[styles.th, styles.col]}>Service</Text>
            <Text style={[styles.th, styles.col]}>Criticality</Text>
            <Text style={[styles.th, styles.col]}>Risk</Text>
            <Text style={[styles.th, styles.col]}>Score</Text>
          </View>
          {data.vendors.all.map((vendor) => (
            <View key={vendor.name} style={styles.rowStack}>
              <View style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
                <Text style={[styles.td, styles.colLarge]}>{vendor.name}</Text>
                <Text style={[styles.td, styles.col]}>{vendor.service}</Text>
                <Text style={[styles.td, styles.col]}>{vendor.criticality}</Text>
                <Text style={[styles.td, styles.col]}>{vendor.risk}</Text>
                <Text style={[styles.td, styles.col]}>{vendor.score}</Text>
              </View>

              <TraceEvidenceBlock trace={vendor.trace} title="Found in source documents" limit={1} />
            </View>
          ))}
        </View>

        <Footer data={data} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageTitle
          eyebrow="Gap analysis"
          title="Regulatory and technology findings"
          subtitle={`${data.gaps.findings.length} findings across ${data.gaps.categories.length} risk domains. ${data.gaps.highCount} high-severity items require priority remediation.`}
        />

        <View style={styles.warningCard}>
          <Text style={styles.sectionTitle}>Priority interpretation</Text>
          <Text style={styles.body}>{scenario.headlineFinding} {scenario.mainRisk}</Text>
        </View>

        {data.gaps.findings.slice(0, 10).map((finding) => (
          <View key={`${finding.title}-${finding.vendor}-${finding.category}`} style={styles.card}>
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <Text style={{ fontSize: 11, fontWeight: 800, color: theme.neutral.text }}>{finding.title}</Text>
              <SeverityBadge level={finding.severity} />
            </View>

            <Text style={[styles.td, { marginBottom: 4 }]}>
              {finding.category} · {finding.vendor} · {finding.article}
            </Text>

            <TraceEvidenceBlock trace={finding.trace} title="Evidence behind this finding" limit={2} />

            <Text style={[styles.traceLabel, { marginTop: 8 }]}>Recommended action</Text>
            <Text style={styles.body}>{finding.rec}</Text>
          </View>
        ))}

        <Footer data={data} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageTitle
          eyebrow="Evidence"
          title="Evidence coverage"
          subtitle="Evidence status across contracts, assurance reports, certificates, continuity plans, and exit strategies."
        />

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <MetricCard label="Coverage" value={`${data.evidence.coverage}%`} sub="Sample assessment" highlight />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="Valid" value={data.evidence.valid} sub="Current and accepted" />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="Traceable evidence" value={data.traceability.evidenceWithTrace} sub={`${data.traceability.totalEvidenceTraces} source links`} />
          </View>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.sectionTitle}>Evidence observation</Text>
          <Text style={styles.body}>
            {scenario.headlineFinding} Missing documentation around exit planning and resilience
            evidence would likely be challenged during a formal review.
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.rowHeader}>
            <Text style={[styles.th, styles.colLarge]}>Evidence</Text>
            <Text style={[styles.th, styles.col]}>Vendor</Text>
            <Text style={[styles.th, styles.col]}>Status</Text>
            <Text style={[styles.th, styles.col]}>Expires</Text>
          </View>
          {data.evidence.items.map((item) => (
            <View key={`${item.name}-${item.vendor}-${item.type}`} style={styles.rowStack}>
              <View style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
                <Text style={[styles.td, styles.colLarge]}>{item.name}</Text>
                <Text style={[styles.td, styles.col]}>{item.vendor}</Text>
                <Text style={[styles.td, styles.col]}>{item.status}</Text>
                <Text style={[styles.td, styles.col]}>{item.expires}</Text>
              </View>

              <TraceEvidenceBlock trace={item.trace} title="Evidence source" limit={1} />
            </View>
          ))}
        </View>

        <Footer data={data} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageTitle
          eyebrow="Concentration"
          title="Dependency and outage impact"
          subtitle="Cloud, hyperscaler, sovereignty, and provider-outage concentration analysis."
        />

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <MetricCard label="Primary provider" value={data.concentration.topProvider.label} sub={`${data.concentration.topProvider.pct}% cloud dependency`} />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="Outage impact" value={data.concentration.simulation.impact} sub={`${data.concentration.simulation.affectedDependencies} dependencies affected`} highlight />
          </View>
          <View style={styles.gridItem}>
            <MetricCard label="Recovery" value={data.concentration.simulation.recovery.split(' ')[0]} sub={data.concentration.simulation.recovery} />
          </View>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.sectionTitle}>
            Outage simulation: {data.concentration.simulation.provider} unavailable
          </Text>
          <Text style={styles.body}>
            {data.concentration.simulation.affectedDependencies} dependencies would be affected.
            Estimated recovery: {data.concentration.simulation.recovery}.{' '}
            {data.concentration.simulation.recommendation}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Cloud dependency share</Text>
        {data.concentration.cloudRisk.map((provider) => (
          <View key={provider.label} style={{ marginBottom: 9 }}>
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.td}>{provider.label} · {provider.spend}/yr</Text>
              <Text style={[styles.td, styles.strong]}>{provider.pct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${provider.pct}%` }]} />
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Affected services</Text>
        {data.concentration.simulation.affectedServices.map((service) => (
          <Text key={service} style={styles.body}>• {service}</Text>
        ))}

        <Footer data={data} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageTitle
          eyebrow="Audit package"
          title="Generated board and audit outputs"
          subtitle={`${data.audit.items.length} documents · ${data.audit.totalPages} generated pages · ready for review workflow.`}
        />

        <View style={styles.successCard}>
          <Text style={styles.sectionTitle}>Package generated for review</Text>
          <Text style={styles.body}>
            This sample package includes supplier registers, evidence inventory, gap analysis,
            dependency mapping, concentration risk, source traceability, and remediation actions.
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.rowHeader}>
            <Text style={[styles.th, styles.colLarge]}>Document</Text>
            <Text style={[styles.th, styles.col]}>Type</Text>
            <Text style={[styles.th, styles.col]}>Pages</Text>
          </View>
          {data.audit.items.map((item) => (
            <View key={item.label} style={styles.row}>
              <Text style={[styles.td, styles.colLarge]}>{item.label}</Text>
              <Text style={[styles.td, styles.col]}>{item.type}</Text>
              <Text style={[styles.td, styles.col]}>{item.pages}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recommended next actions</Text>
        {data.audit.recommendations.map((recommendation, index) => (
          <Text key={recommendation} style={styles.body}>{index + 1}. {recommendation}</Text>
        ))}

        <Footer data={data} />
      </Page>
    </Document>
  );
}
