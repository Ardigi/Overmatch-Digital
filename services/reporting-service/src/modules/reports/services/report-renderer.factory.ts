import { Injectable, Logger } from '@nestjs/common';
import type { ReportTemplate } from '../entities/report-template.entity';
import type { CsvRenderer } from './renderers/csv.renderer';
import type { ExcelRenderer } from './renderers/excel.renderer';
import type { JsonRenderer } from './renderers/json.renderer';
import type { PdfRenderer } from './renderers/pdf.renderer';
import type { WordRenderer } from './renderers/word.renderer';

export interface ReportRenderer {
  render(data: any, template?: ReportTemplate): Promise<RenderedContent>;
}

export interface RenderedContent {
  content: Buffer;
  mimeType: string;
  fileName: string;
  pageCount?: number;
  size: number;
}

@Injectable()
export class ReportRendererFactory {
  private readonly logger = new Logger(ReportRendererFactory.name);
  private renderers: Map<string, ReportRenderer>;

  constructor(
    private readonly pdfRenderer: PdfRenderer,
    private readonly excelRenderer: ExcelRenderer,
    private readonly wordRenderer: WordRenderer,
    private readonly csvRenderer: CsvRenderer,
    private readonly jsonRenderer: JsonRenderer
  ) {
    this.renderers = new Map<string, ReportRenderer>([
      ['PDF', this.pdfRenderer],
      ['EXCEL', this.excelRenderer],
      ['WORD', this.wordRenderer],
      ['CSV', this.csvRenderer],
      ['JSON', this.jsonRenderer],
    ]);
  }

  getRenderer(format: string): ReportRenderer | null {
    const renderer = this.renderers.get(format.toUpperCase());

    if (!renderer) {
      this.logger.warn(`No renderer found for format: ${format}`);
      return null;
    }

    return renderer;
  }

  getSupportedFormats(): string[] {
    return Array.from(this.renderers.keys());
  }
}
