import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report, ReportSchedule, ReportTemplate } from './entities';
import { ReportsController } from './reports.controller';
import { CsvRenderer } from './services/renderers/csv.renderer';
import { ExcelRenderer } from './services/renderers/excel.renderer';
import { JsonRenderer } from './services/renderers/json.renderer';
import { PdfRenderer } from './services/renderers/pdf.renderer';
import { WordRenderer } from './services/renderers/word.renderer';
import { ReportDataCollector } from './services/report-data-collector.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { ReportRendererFactory } from './services/report-renderer.factory';
import { ReportSchedulerService } from './services/report-scheduler.service';
import { ReportSecurityService } from './services/report-security.service';
import { ReportStorageService } from './services/report-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, ReportTemplate, ReportSchedule]),
    BullModule.registerQueue({
      name: 'report-generation',
    }),
    HttpModule,
  ],
  controllers: [ReportsController],
  providers: [
    ReportGeneratorService,
    ReportStorageService,
    ReportSchedulerService,
    ReportDataCollector,
    ReportRendererFactory,
    ReportSecurityService,
    PdfRenderer,
    ExcelRenderer,
    WordRenderer,
    CsvRenderer,
    JsonRenderer,
  ],
  exports: [
    ReportGeneratorService,
    ReportStorageService,
    ReportSchedulerService,
    ReportSecurityService,
  ],
})
export class ReportsModule {}
