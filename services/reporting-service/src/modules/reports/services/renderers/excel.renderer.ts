import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import type { ReportTemplate } from '../../entities/report-template.entity';
import type { RenderedContent, ReportRenderer } from '../report-renderer.factory';

@Injectable()
export class ExcelRenderer implements ReportRenderer {
  private readonly logger = new Logger(ExcelRenderer.name);

  async render(data: any, template?: ReportTemplate): Promise<RenderedContent> {
    try {
      const workbook = XLSX.utils.book_new();

      // Add summary sheet
      const summaryData = this.prepareSummarySheet(data);
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Add section sheets
      if (data.sections) {
        data.sections.forEach((section: any) => {
          const sheetData = this.prepareSectionSheet(section);
          if (sheetData.length > 0) {
            const sheet = XLSX.utils.json_to_sheet(sheetData);
            const sheetName = this.sanitizeSheetName(section.title);
            XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
          }
        });
      }

      // Generate buffer
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      return {
        content: Buffer.from(buffer),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: `report_${Date.now()}.xlsx`,
        size: buffer.length,
      };
    } catch (error) {
      this.logger.error('Failed to render Excel', error);
      throw error;
    }
  }

  private prepareSummarySheet(data: any): any[] {
    const summary = [];

    // Header information
    summary.push({
      Field: 'Report Title',
      Value: data.header?.title || 'Report',
    });
    summary.push({
      Field: 'Organization',
      Value: data.header?.organizationName || '',
    });
    summary.push({
      Field: 'Report Period',
      Value: data.header?.reportPeriod || '',
    });
    summary.push({
      Field: 'Generated Date',
      Value: new Date().toLocaleDateString(),
    });

    // Add empty row
    summary.push({ Field: '', Value: '' });

    // Summary statistics
    if (data.summary) {
      summary.push({
        Field: 'Overall Score',
        Value: `${data.summary.overallScore}%`,
      });
      summary.push({
        Field: 'Total Controls',
        Value: data.summary.totalControls,
      });
      summary.push({
        Field: 'Effective Controls',
        Value: data.summary.effectiveControls,
      });
      summary.push({
        Field: 'Failed Controls',
        Value: data.summary.failedControls,
      });
      summary.push({
        Field: 'Critical Findings',
        Value: data.summary.criticalFindings,
      });
      summary.push({
        Field: 'High Findings',
        Value: data.summary.highFindings,
      });
      summary.push({
        Field: 'Medium Findings',
        Value: data.summary.mediumFindings,
      });
      summary.push({
        Field: 'Low Findings',
        Value: data.summary.lowFindings,
      });
    }

    return summary;
  }

  private prepareSectionSheet(section: any): any[] {
    const sheetData = [];

    // If section has tables, convert them
    if (section.tables) {
      section.tables.forEach((table: any) => {
        // Add table title
        sheetData.push({ [table.headers[0]]: table.title });
        sheetData.push({}); // Empty row

        // Add table data
        table.rows.forEach((row: any[]) => {
          const rowObj: any = {};
          table.headers.forEach((header: string, index: number) => {
            rowObj[header] = row[index];
          });
          sheetData.push(rowObj);
        });

        sheetData.push({}); // Empty row after table
      });
    }

    // If section has findings, convert them
    if (section.findings) {
      const findingsData = section.findings.map((finding: any) => ({
        ID: finding.id,
        Title: finding.title,
        Severity: finding.severity,
        Status: finding.status,
        Description: finding.description,
        Impact: finding.impact,
        Recommendation: finding.recommendation,
      }));
      sheetData.push(...findingsData);
    }

    // If section has plain content, add as single cell
    if (section.content && sheetData.length === 0) {
      sheetData.push({ Content: section.content });
    }

    return sheetData;
  }

  private sanitizeSheetName(name: string): string {
    // Excel sheet names have restrictions
    let sanitized = name.substring(0, 31); // Max 31 chars
    sanitized = sanitized.replace(/[:\\/?*[\]]/g, ''); // Remove invalid chars
    return sanitized || 'Sheet';
  }
}
