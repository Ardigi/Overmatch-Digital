import { Injectable, Logger } from '@nestjs/common';
import type { ReportTemplate } from '../../entities/report-template.entity';
import type { RenderedContent, ReportRenderer } from '../report-renderer.factory';

@Injectable()
export class JsonRenderer implements ReportRenderer {
  private readonly logger = new Logger(JsonRenderer.name);

  async render(data: any, template?: ReportTemplate): Promise<RenderedContent> {
    try {
      const jsonContent = JSON.stringify(data, null, 2);

      return {
        content: Buffer.from(jsonContent, 'utf-8'),
        mimeType: 'application/json',
        fileName: `report_${Date.now()}.json`,
        size: Buffer.byteLength(jsonContent),
      };
    } catch (error) {
      this.logger.error('Failed to render JSON', error);
      throw error;
    }
  }
}
