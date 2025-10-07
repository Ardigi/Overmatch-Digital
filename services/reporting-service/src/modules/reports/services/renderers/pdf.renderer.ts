import { Injectable, Logger } from '@nestjs/common';
import * as handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';
import type { ReportTemplate } from '../../entities/report-template.entity';
import type { RenderedContent, ReportRenderer } from '../report-renderer.factory';

@Injectable()
export class PdfRenderer implements ReportRenderer {
  private readonly logger = new Logger(PdfRenderer.name);

  async render(data: any, template?: ReportTemplate): Promise<RenderedContent> {
    try {
      // Generate HTML content
      const html = this.generateHtml(data, template);

      // Launch puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Set PDF options
      const pdfOptions: any = {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm',
        },
      };

      // Apply template configuration if available
      if (template?.configuration) {
        if (template.configuration.pageSize) {
          pdfOptions.format = template.configuration.pageSize;
        }
        if (template.configuration.orientation) {
          pdfOptions.landscape = template.configuration.orientation === 'landscape';
        }
        if (template.configuration.margins) {
          pdfOptions.margin = {
            top: `${template.configuration.margins.top}mm`,
            bottom: `${template.configuration.margins.bottom}mm`,
            left: `${template.configuration.margins.left}mm`,
            right: `${template.configuration.margins.right}mm`,
          };
        }
      }

      // Add header and footer if configured
      if (template?.configuration?.headerTemplate) {
        pdfOptions.displayHeaderFooter = true;
        pdfOptions.headerTemplate = template.configuration.headerTemplate;
      }
      if (template?.configuration?.footerTemplate) {
        pdfOptions.displayHeaderFooter = true;
        pdfOptions.footerTemplate = template.configuration.footerTemplate;
      }

      // Generate PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      // Get page count (approximate)
      const pageCount = Math.ceil(html.length / 3000); // Rough estimate

      await browser.close();

      return {
        content: pdfBuffer,
        mimeType: 'application/pdf',
        fileName: `report_${Date.now()}.pdf`,
        pageCount,
        size: pdfBuffer.length,
      };
    } catch (error) {
      this.logger.error('Failed to render PDF', error);
      throw error;
    }
  }

  private generateHtml(data: any, template?: ReportTemplate): string {
    if (template?.templateContent) {
      // Use handlebars template
      const compiledTemplate = handlebars.compile(template.templateContent);
      return compiledTemplate(data);
    }

    // Generate default HTML
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.header?.title || 'Report'}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .header {
      background-color: #f4f4f4;
      padding: 20px;
      text-align: center;
      border-bottom: 3px solid #0066cc;
    }
    .header h1 {
      margin: 0;
      color: #0066cc;
    }
    .header .subtitle {
      color: #666;
      margin-top: 10px;
    }
    .content {
      padding: 20px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #0066cc;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    table th, table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    table th {
      background-color: #f4f4f4;
      font-weight: bold;
    }
    .finding {
      border: 1px solid #ddd;
      padding: 15px;
      margin: 10px 0;
      border-radius: 5px;
    }
    .finding.critical {
      border-left: 5px solid #dc3545;
    }
    .finding.high {
      border-left: 5px solid #fd7e14;
    }
    .finding.medium {
      border-left: 5px solid #ffc107;
    }
    .finding.low {
      border-left: 5px solid #28a745;
    }
    .footer {
      margin-top: 50px;
      padding: 20px;
      background-color: #f4f4f4;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    @media print {
      .page-break {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.header?.title || 'Report'}</h1>
    <div class="subtitle">
      ${data.header?.organizationName || ''}
      ${data.header?.reportPeriod ? `<br>Period: ${data.header.reportPeriod}` : ''}
      <br>Generated: ${new Date().toLocaleDateString()}
    </div>
  </div>
  
  <div class="content">
    ${this.renderSections(data.sections || [])}
  </div>
  
  <div class="footer">
    ${data.footer?.disclaimer || 'This report is confidential and proprietary.'}
    <br>
    ${data.footer?.copyright || '© SOC Compliance Platform'}
  </div>
</body>
</html>
    `;
  }

  private renderSections(sections: any[]): string {
    return sections
      .sort((a, b) => a.order - b.order)
      .map((section) => this.renderSection(section))
      .join('\n');
  }

  private renderSection(section: any): string {
    let html = `
      <div class="section">
        <h2>${section.title}</h2>
    `;

    // Render content
    if (section.content) {
      html += `<div>${section.content}</div>`;
    }

    // Render tables
    if (section.tables) {
      section.tables.forEach((table: any) => {
        html += this.renderTable(table);
      });
    }

    // Render findings
    if (section.findings) {
      section.findings.forEach((finding: any) => {
        html += this.renderFinding(finding);
      });
    }

    // Render charts (as placeholders in PDF)
    if (section.charts) {
      section.charts.forEach((chart: any) => {
        html += `<div class="chart-placeholder">[Chart: ${chart.title}]</div>`;
      });
    }

    html += '</div>';
    return html;
  }

  private renderTable(table: any): string {
    let html = `
      <h3>${table.title}</h3>
      <table>
        <thead>
          <tr>
    `;

    // Headers
    table.headers.forEach((header: string) => {
      html += `<th>${header}</th>`;
    });

    html += `
          </tr>
        </thead>
        <tbody>
    `;

    // Rows
    table.rows.forEach((row: any[]) => {
      html += '<tr>';
      row.forEach((cell: any) => {
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    });

    html += `
        </tbody>
      </table>
    `;

    return html;
  }

  private renderFinding(finding: any): string {
    return `
      <div class="finding ${finding.severity}">
        <h4>${finding.title}</h4>
        <p><strong>Severity:</strong> ${finding.severity}</p>
        <p><strong>Description:</strong> ${finding.description}</p>
        <p><strong>Impact:</strong> ${finding.impact}</p>
        <p><strong>Recommendation:</strong> ${finding.recommendation}</p>
        <p><strong>Status:</strong> ${finding.status}</p>
      </div>
    `;
  }
}
