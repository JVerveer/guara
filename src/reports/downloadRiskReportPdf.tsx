import { pdf } from '@react-pdf/renderer';
import { buildRiskReportData, type RiskReportScenario } from './buildRiskReportData';
import { RiskReportPdf } from './RiskReportPdf';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function downloadRiskReportPdf(activeScenario: RiskReportScenario) {
  const data = buildRiskReportData(activeScenario);
  const blob = await pdf(<RiskReportPdf data={data} />).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `guara-risk-report-${slugify(activeScenario.name)}.pdf`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
