import { pdf } from '@react-pdf/renderer';
import type { AnalysisResult } from '../analysis/types';
import type { ReportSections } from '../app/components/ui/ConversionModal';
import { buildRiskReportData } from './buildRiskReportData';
import { RiskReportPdf } from './RiskReportPdf';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function downloadRiskReportPdf(
  analysisResult: AnalysisResult,
  reportSections: ReportSections
) {
  const data = buildRiskReportData(analysisResult, reportSections);
  const blob = await pdf(<RiskReportPdf data={data} />).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `guara-risk-report-${slugify(analysisResult.scenario.name)}.pdf`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
