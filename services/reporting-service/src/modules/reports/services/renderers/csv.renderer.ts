import { Injectable, Logger } from '@nestjs/common';
import type { ReportTemplate } from '../../entities/report-template.entity';
import type { RenderedContent, ReportRenderer } from '../report-renderer.factory';

@Injectable()
export class CsvRenderer implements ReportRenderer {
  private readonly logger = new Logger(CsvRenderer.name);

  async render(data: any, template?: ReportTemplate): Promise<RenderedContent> {
    try {
      const csvContent = this.generateCsv(data);

      return {
        content: Buffer.from(csvContent, 'utf-8'),
        mimeType: 'text/csv',
        fileName: `report_${Date.now()}.csv`,
        size: Buffer.byteLength(csvContent),
      };
    } catch (error) {
      this.logger.error('Failed to render CSV', error);
      throw error;
    }
  }

  private generateCsv(data: any): string {
    const rows: string[] = [];

    // Header information
    rows.push('"Field","Value"');
    rows.push(`"Report Title","${data.header?.title || 'Report'}"`);
    rows.push(`"Organization","${data.header?.organizationName || ''}"`);
    rows.push(`"Report Period","${data.header?.reportPeriod || ''}"`);
    rows.push(`"Generated Date","${new Date().toLocaleDateString()}"`);
    rows.push(''); // Empty row

    // Summary data
    if (data.summary) {
      rows.push('"Summary","Value"');
      rows.push(`"Overall Score","${data.summary.overallScore}%"`);
      rows.push(`"Total Controls","${data.summary.totalControls}"`);
      rows.push(`"Effective Controls","${data.summary.effectiveControls}"`);
      rows.push(`"Failed Controls","${data.summary.failedControls}"`);
      rows.push(`"Critical Findings","${data.summary.criticalFindings}"`);
      rows.push(`"High Findings","${data.summary.highFindings}"`);
      rows.push(`"Medium Findings","${data.summary.mediumFindings}"`);
      rows.push(`"Low Findings","${data.summary.lowFindings}"`);
      rows.push(''); // Empty row
    }

    // Process sections
    if (data.sections) {
      data.sections.forEach((section: any) => {
        rows.push(`"${section.title}"`);

        // Tables
        if (section.tables) {
          section.tables.forEach((table: any) => {
            rows.push(`"${table.title}"`);
            rows.push(table.headers.map((h: string) => `"${h}"`).join(','));

            table.rows.forEach((row: any[]) => {
              rows.push(row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
            });
            rows.push(''); // Empty row after table
          });
        }

        // Findings
        if (section.findings) {
          rows.push('"ID","Title","Severity","Status","Description","Impact","Recommendation"');
          section.findings.forEach((finding: any) => {
            rows.push(
              [
                finding.id,
                finding.title,
                finding.severity,
                finding.status,
                finding.description,
                finding.impact,
                finding.recommendation,
              ]
                .map((val) => `"${String(val).replace(/"/g, '""')}"`)
                .join(',')
            );
          });
          rows.push(''); // Empty row
        }
      });
    }

    return rows.join('\n');
  }
}
