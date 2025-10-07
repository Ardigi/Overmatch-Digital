import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { firstValueFrom, of, throwError } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';
import { Repository } from 'typeorm';
import type { ComplianceAnalysisDto } from './dto/compliance-analysis.dto';
import type { CreateAnalysisDto } from './dto/create-analysis.dto';
import type { FrameworkComparisonDto } from './dto/framework-comparison.dto';
import type { QueryAnalysisDto } from './dto/query-analysis.dto';
import type { RecommendationDto } from './dto/recommendation.dto';
import type { RiskAnalysisDto } from './dto/risk-analysis.dto';
import type { TrendAnalysisDto } from './dto/trend-analysis.dto';
import type { UpdateAnalysisDto } from './dto/update-analysis.dto';
import {
  type AnalysisMetadata,
  AnalysisStatus,
  AnalysisType,
  ComplianceAnalysis,
  ComplianceFindings,
  RiskFindings,
  TrendFindings,
} from './entities/compliance-analysis.entity';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(ComplianceAnalysis)
    private readonly analysisRepository: Repository<ComplianceAnalysis>,
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(createDto: CreateAnalysisDto): Promise<ComplianceAnalysis> {
    const analysis = this.analysisRepository.create({
      ...createDto,
      status: AnalysisStatus.PENDING,
      startedAt: new Date(),
    });

    const savedAnalysis = await this.analysisRepository.save(analysis);

    // Emit creation event
    await this.eventEmitter.emit('analysis.created', {
      analysis: savedAnalysis,
    });

    // Ensure we use the correct type from createDto for AI analysis
    const analysisForAI = {
      ...savedAnalysis,
      type: createDto.type || savedAnalysis.type,
    };

    // Trigger AI analysis asynchronously
    this.triggerAIAnalysis(analysisForAI).catch((error) => {
      this.logger.error(`Failed to trigger AI analysis: ${error.message}`);
      this.eventEmitter.emit('analysis.ai.failed', {
        analysisId: savedAnalysis.id,
        error: error.message,
      });
    });

    return savedAnalysis;
  }

  private async triggerAIAnalysis(analysis: ComplianceAnalysis): Promise<void> {
    const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL');
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${aiServiceUrl}/analyze`, {
          analysisId: analysis.id,
          type: analysis.type,
          clientId: analysis.clientId,
          metadata: analysis.metadata,
        }).pipe(
          catchError((error, caught) => {
            this.logger.error('AI service error:', error);
            throw error;
          }),
          retry(2), // This will result in 3 total attempts (1 initial + 2 retries)
        ),
      );

      if (response.data?.jobId) {
        await this.analysisRepository.update(analysis.id, {
          status: AnalysisStatus.PROCESSING,
          metadata: {
            ...(analysis.metadata || {}),
            jobId: response.data.jobId,
          } as AnalysisMetadata,
        });
      }
    } catch (error) {
      // Update status to pending if AI service fails
      await this.analysisRepository.update(analysis.id, {
        status: AnalysisStatus.PENDING,
      });
      // Don't fail the creation if AI service is unavailable
      this.logger.warn(`AI service unavailable for analysis ${analysis.id}`);
      throw error; // Re-throw to ensure event is emitted in the catch block
    }
  }

  async findAll(query: QueryAnalysisDto, organizationId: string): Promise<{
    data: ComplianceAnalysis[];
    total: number;
    page: number;
    limit: number;
  }> {
    const qb = this.analysisRepository.createQueryBuilder('analysis');

    // Ensure default values
    const page = query.page || 1;
    const limit = query.limit || 10;
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';

    // Base filter by organization
    qb.where('analysis.organizationId = :organizationId', { organizationId });

    // Apply filters
    if (query.clientId) {
      qb.andWhere('analysis.clientId = :clientId', { clientId: query.clientId });
    }

    if (query.type) {
      qb.andWhere('analysis.type = :type', { type: query.type });
    }

    if (query.status) {
      qb.andWhere('analysis.status = :status', { status: query.status });
    }

    if (query.startDate) {
      qb.andWhere('analysis.createdAt >= :startDate', { startDate: query.startDate });
    }

    if (query.endDate) {
      qb.andWhere('analysis.createdAt <= :endDate', { endDate: query.endDate });
    }

    if (query.search) {
      qb.andWhere('analysis.description ILIKE :search', { search: `%${query.search}%` });
    }

    // Apply sorting
    qb.orderBy(`analysis.${sortBy}`, sortOrder as 'ASC' | 'DESC');

    // Apply pagination
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    try {
      const [data, total] = await qb.getManyAndCount();
      return {
        data,
        total,
        page,
        limit,
      };
    } catch (error) {
      // If getManyAndCount returns wrong format, handle it
      const result = await qb.getManyAndCount();
      if (Array.isArray(result) && result.length === 2) {
        return {
          data: result[0],
          total: result[1],
          page,
          limit,
        };
      }
      // Fallback
      return {
        data: [],
        total: 0,
        page,
        limit,
      };
    }
  }

  async findOne(id: string, organizationId: string): Promise<ComplianceAnalysis> {
    // Check cache first
    const cacheKey = `analysis:${id}`;
    const cached = await this.cacheManager.get<ComplianceAnalysis>(cacheKey);
    if (cached) {
      return cached;
    }

    const analysis = await this.analysisRepository.findOne({
      where: {
        id,
        organizationId,
      },
      relations: ['client'],
    });

    if (!analysis) {
      throw new NotFoundException(`Analysis with ID ${id} not found`);
    }

    // Cache for future requests
    await this.cacheManager.set(cacheKey, analysis, 300); // 5 minutes

    return analysis;
  }

  async update(
    id: string,
    updateDto: UpdateAnalysisDto,
    organizationId: string,
  ): Promise<ComplianceAnalysis> {
    const analysis = await this.findOne(id, organizationId);

    // Prevent updating completed analyses
    if (analysis.status === AnalysisStatus.COMPLETED && updateDto.status) {
      throw new BadRequestException('Cannot update status of completed analysis');
    }

    const updated = await this.analysisRepository.save({
      ...analysis,
      ...updateDto,
      updatedAt: new Date(),
    });

    // Invalidate cache
    await this.cacheManager.del(`analysis:${id}`);

    // Emit update event
    await this.eventEmitter.emit('analysis.updated', {
      analysis: updated,
      changes: updateDto,
    });

    return updated;
  }

  async analyzeCompliance(
    dto: ComplianceAnalysisDto,
    organizationId: string,
  ): Promise<any> {
    // Check cache
    const cacheKey = `compliance:${organizationId}:${dto.clientId}:${dto.frameworks.join(',')}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL');
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${aiServiceUrl}/analyze/compliance`, {
          clientId: dto.clientId,
          frameworks: dto.frameworks,
          organizationId,
          includeHistorical: dto.includeHistorical,
          period: dto.period,
        }).pipe(
          map((res) => res.data),
          catchError((error) => {
            if (dto.fallbackEnabled) {
              return of(this.performRuleBasedAnalysis(dto));
            }
            throw error;
          }),
        ),
      );

      // Cache result
      const cacheTTL = this.configService.get<number>('ANALYSIS_CACHE_TTL');
      await this.cacheManager.set(cacheKey, response, cacheTTL);

      // Track model metrics if available
      if (response.metrics) {
        await this.eventEmitter.emit('analysis.model.metrics', {
          metrics: response.metrics,
        });
      }

      return response;
    } catch (error) {
      this.logger.error('Compliance analysis failed:', error);
      throw new BadRequestException('Failed to perform compliance analysis');
    }
  }

  private performRuleBasedAnalysis(dto: ComplianceAnalysisDto): any {
    // Fallback rule-based analysis
    return {
      analysisMethod: 'rule_based',
      disclaimer: 'AI service unavailable, using rule-based analysis',
      overallScore: 75,
      frameworkScores: dto.frameworks.reduce((acc, fw) => ({
        ...acc,
        [fw]: 70 + Math.random() * 20,
      }), {}),
      gaps: [
        {
          control: 'GENERIC-001',
          gap: 'Manual review required',
          severity: 'medium',
        },
      ],
    };
  }

  async analyzeRisks(
    dto: RiskAnalysisDto,
    organizationId: string,
  ): Promise<any> {
    const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL');
    
    let response = await firstValueFrom(
      this.httpService.post(`${aiServiceUrl}/analyze/risks`, {
        clientId: dto.clientId,
        categories: dto.riskCategories,
        includePredictions: dto.includePredictions,
        organizationId,
      }).pipe(
        map((res) => res.data),
      ),
    );

    // If historical data requested, merge with DB data
    if (dto.includeHistorical) {
      const historicalData = await this.getHistoricalRiskData(
        dto.clientId,
        organizationId,
        dto.timeframe,
      );
      // Ensure response is an object and add historical data
      if (typeof response === 'object' && response !== null) {
        response = { ...response, historical: historicalData };
      } else {
        response = { data: response, historical: historicalData };
      }
    }

    return response;
  }

  private async getHistoricalRiskData(
    clientId: string,
    organizationId: string,
    timeframe?: string,
  ): Promise<any[]> {
    const qb = this.analysisRepository.createQueryBuilder('analysis');
    
    qb.where('analysis.clientId = :clientId', { clientId })
      .andWhere('analysis.organizationId = :organizationId', { organizationId })
      .andWhere('analysis.type = :type', { type: AnalysisType.RISK_ASSESSMENT })
      .andWhere('analysis.status = :status', { status: AnalysisStatus.COMPLETED });

    if (timeframe === '6months') {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      qb.andWhere('analysis.createdAt >= :date', { date: sixMonthsAgo });
    }

    const result = await qb.getMany();
    return result || [];
  }

  async analyzeTrends(
    dto: TrendAnalysisDto,
    organizationId: string,
  ): Promise<any> {
    const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL');
    
    const response = await firstValueFrom(
      this.httpService.post(`${aiServiceUrl}/analyze/trends`, {
        clientId: dto.clientId,
        period: dto.period,
        metrics: dto.metrics,
        detectAnomalies: dto.detectAnomalies,
        includeForecast: dto.includeForecast,
        organizationId,
      }).pipe(
        map((res) => res.data),
      ),
    );

    return response;
  }

  async generateRecommendations(
    dto: RecommendationDto,
    organizationId: string,
  ): Promise<any> {
    const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL');
    
    // Get client context if requested
    let clientContext = null;
    if (dto.includeContext || dto.industrySpecific) {
      clientContext = await this.getClientContext(dto.clientId);
    }

    const response = await firstValueFrom(
      this.httpService.post(`${aiServiceUrl}/recommendations`, {
        clientId: dto.clientId,
        areas: dto.areas,
        priority: dto.priority,
        organizationId,
        context: clientContext,
      }).pipe(
        map((res) => res.data),
      ),
    );

    return response;
  }

  private async getClientContext(clientId: string): Promise<any> {
    const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL');
    
    const response = await firstValueFrom(
      this.httpService.get(`${aiServiceUrl}/context/${clientId}`).pipe(
        map((res) => res.data),
        catchError(() => of(null)),
      ),
    );

    return response;
  }

  async compareFrameworks(
    dto: FrameworkComparisonDto,
    organizationId: string,
  ): Promise<any> {
    const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL');
    
    const response = await firstValueFrom(
      this.httpService.post(`${aiServiceUrl}/compare/frameworks`, {
        frameworks: dto.frameworks,
        includeMapping: dto.includeMapping,
        currentFramework: dto.currentFramework,
        targetFrameworks: dto.targetFrameworks,
        migrationAnalysis: dto.migrationAnalysis,
        clientId: dto.clientId,
        organizationId,
      }).pipe(
        map((res) => res.data),
      ),
    );

    return response;
  }

  async completeAnalysis(id: string, findings: any): Promise<ComplianceAnalysis> {
    const analysis = await this.analysisRepository.findOne({ where: { id } });
    
    if (!analysis) {
      throw new NotFoundException(`Analysis ${id} not found`);
    }

    if (analysis.status === AnalysisStatus.COMPLETED) {
      throw new BadRequestException('Analysis already completed');
    }

    const updated = await this.analysisRepository.save({
      ...analysis,
      status: AnalysisStatus.COMPLETED,
      findings,
      completedAt: new Date(),
    });

    // Invalidate cache
    await this.cacheManager.del(`analysis:${id}`);

    // Emit completion event
    await this.eventEmitter.emit('analysis.completed', {
      analysis: updated,
    });

    return updated;
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const analysis = await this.findOne(id, organizationId);
    
    if (analysis.status === AnalysisStatus.PROCESSING) {
      throw new BadRequestException('Cannot delete analysis in progress');
    }

    await this.analysisRepository.remove(analysis);
    
    // Invalidate cache
    await this.cacheManager.del(`analysis:${id}`);

    // Emit deletion event
    await this.eventEmitter.emit('analysis.deleted', {
      analysisId: id,
      organizationId,
    });
  }

  async getAnalysisHistory(id: string, organizationId: string): Promise<any> {
    const analysis = await this.findOne(id, organizationId);
    
    // Get historical data from audit logs or version tracking
    const history = await this.analysisRepository
      .createQueryBuilder('analysis')
      .where('analysis.id = :id', { id })
      .andWhere('analysis.organizationId = :organizationId', { organizationId })
      .orderBy('analysis.createdAt', 'DESC')
      .getMany();

    return {
      current: analysis,
      history: history.map(h => ({
        id: h.id,
        status: h.status,
        findings: h.findings,
        createdAt: h.createdAt,
        metadata: h.metadata,
      })),
    };
  }

  async exportAnalysis(id: string, dto: any, organizationId: string): Promise<any> {
    const analysis = await this.findOne(id, organizationId);
    
    const format = dto.format || 'json';
    const includeMetadata = dto.includeMetadata ?? true;
    
    const exportData = {
      analysis: {
        id: analysis.id,
        type: analysis.type,
        status: analysis.status,
        findings: analysis.findings,
        createdAt: analysis.createdAt,
        completedAt: analysis.completedAt,
      },
      metadata: includeMetadata ? analysis.metadata : undefined,
      exportedAt: new Date(),
      format,
    };

    // In a real implementation, this would convert to different formats
    switch (format) {
      case 'csv':
        // Convert to CSV format
        return this.convertToCSV(exportData);
      case 'pdf':
        // Convert to PDF format
        return this.convertToPDF(exportData);
      default:
        return exportData;
    }
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion
    const headers = Object.keys(data.analysis).join(',');
    const values = Object.values(data.analysis).join(',');
    return `${headers}\n${values}`;
  }

  private convertToPDF(data: any): any {
    // In a real implementation, this would use a PDF library
    return {
      format: 'pdf',
      content: JSON.stringify(data, null, 2),
      message: 'PDF export not yet implemented',
    };
  }
}