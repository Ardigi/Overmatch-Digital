import { Injectable, Logger } from '@nestjs/common';
import type { ReportTemplate } from '../../entities/report-template.entity';
import type { RenderedContent, ReportRenderer } from '../report-renderer.factory';

@Injectable()
export class WordRenderer implements ReportRenderer {
  private readonly logger = new Logger(WordRenderer.name);

  async render(data: any, template?: ReportTemplate): Promise<RenderedContent> {
    try {
      // For now, return a simple implementation
      // In production, you would use a library like docx or officegen
      const content = this.generateSimpleWordContent(data);

      return {
        content: Buffer.from(content),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: `report_${Date.now()}.docx`,
        size: content.length,
      };
    } catch (error) {
      this.logger.error('Failed to render Word document', error);
      throw error;
    }
  }

  private generateSimpleWordContent(data: any): string {
    // This is a placeholder - in production, use a proper Word generation library
    let content = `${data.header?.title || 'Report'}\n\n`;
    content += `Organization: ${data.header?.organizationName || ''}\n`;
    content += `Period: ${data.header?.reportPeriod || ''}\n`;
    content += `Generated: ${new Date().toLocaleDateString()}\n\n`;

    if (data.sections) {
      data.sections.forEach((section: any) => {
        content += `\n${section.title}\n`;
        content += '='.repeat(section.title.length) + '\n\n';

        if (section.content) {
          content += `${section.content}\n\n`;
        }

        if (section.findings) {
          section.findings.forEach((finding: any) => {
            content += `Finding: ${finding.title}\n`;
            content += `Severity: ${finding.severity}\n`;
            content += `Description: ${finding.description}\n`;
            content += `Recommendation: ${finding.recommendation}\n\n`;
          });
        }
      });
    }

    return content;
  }
}
