import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventType } from '@soc-compliance/events';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import { KafkaService } from '../../kafka/kafka.service';
import { ControlsService } from '../controls/controls.service';
import type { CreateControlTestDto } from './dto/create-control-test.dto';
import type { UpdateControlTestDto } from './dto/update-control-test.dto';
import { ControlTest, TestMethod, TestStatus } from './entities/control-test.entity';
import { 
  ServiceQueryFilters,
  ControlTestProcedures,
  ControlTestStep,
  AutomationResultData,
  TestEvidenceData,
  EvidenceValidationData,
  ApprovalWorkflowData,
  ControlTestFinding
} from '../../shared/types/control-query.types';

@Injectable()
export class ControlTestsService {
  constructor(
    @InjectRepository(ControlTest)
    private controlTestRepository: Repository<ControlTest>,
    @InjectQueue('control-tests')
    private controlTestQueue: Queue,
    private controlsService: ControlsService,
    private kafkaService: KafkaService,
    private serviceDiscovery: ServiceDiscoveryService,
  ) {}

  async create(createControlTestDto: CreateControlTestDto): Promise<ControlTest> {
    // Validate control exists
    const control = await this.controlsService.findOne(createControlTestDto.controlId);

    const controlTest = this.controlTestRepository.create({
      ...createControlTestDto,
      status: TestStatus.SCHEDULED,
    });

    const savedTest = await this.controlTestRepository.save(controlTest);

    // Queue automated tests
    if (control.automationConfig?.isAutomated && createControlTestDto.method === TestMethod.AUTOMATED) {
      await this.controlTestQueue.add('execute-test', {
        testId: savedTest.id,
        controlId: control.id,
        automationConfig: control.automationConfig,
      }, {
        delay: new Date(createControlTestDto.scheduledDate).getTime() - Date.now(),
      });
    }

    await this.kafkaService.emit(EventType.CONTROL_TEST_SCHEDULED, {
      testId: savedTest.id,
      controlId: control.id,
      controlCode: control.code,
      scheduledDate: savedTest.scheduledDate,
      method: savedTest.method,
    });

    return savedTest;
  }

  async findAll(organizationId: string, filters?: ServiceQueryFilters): Promise<ControlTest[]> {
    const query = this.controlTestRepository
      .createQueryBuilder('test')
      .leftJoinAndSelect('test.control', 'control')
      .where('test.organizationId = :organizationId', { organizationId });

    if (filters?.controlId) {
      query.andWhere('test.controlId = :controlId', { controlId: filters.controlId });
    }

    if (filters?.status) {
      query.andWhere('test.status = :status', { status: filters.status });
    }

    if (filters?.auditId) {
      query.andWhere('test.auditId = :auditId', { auditId: filters.auditId });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('test.scheduledDate BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    return query.orderBy('test.scheduledDate', 'DESC').getMany();
  }

  async findOne(id: string): Promise<ControlTest> {
    const test = await this.controlTestRepository.findOne({
      where: { id },
      relations: ['control'],
    });

    if (!test) {
      throw new NotFoundException(`Control test with ID ${id} not found`);
    }

    return test;
  }

  async update(id: string, updateControlTestDto: UpdateControlTestDto): Promise<ControlTest> {
    const test = await this.findOne(id);
    const previousStatus = test.status;

    Object.assign(test, updateControlTestDto);

    // Update timestamps based on status changes
    if (updateControlTestDto.status === TestStatus.IN_PROGRESS && !test.startedAt) {
      test.startedAt = new Date();
    }

    if (
      updateControlTestDto.status &&
      [TestStatus.PASSED, TestStatus.FAILED, TestStatus.ERROR].includes(updateControlTestDto.status) &&
      !test.completedAt
    ) {
      test.completedAt = new Date();
      test.durationMs = test.completedAt.getTime() - test.startedAt.getTime();
    }

    const updatedTest = await this.controlTestRepository.save(test);

    // Emit status change events
    if (updateControlTestDto.status && updateControlTestDto.status !== previousStatus) {
      await this.emitTestStatusEvent(updatedTest);
    }

    return updatedTest;
  }

  async executeTest(id: string, testerId: string): Promise<ControlTest> {
    const test = await this.findOne(id);

    if (test.status !== TestStatus.SCHEDULED) {
      throw new Error('Test must be in SCHEDULED status to execute');
    }

    // Update test to in progress
    await this.update(id, {
      status: TestStatus.IN_PROGRESS,
      testerId,
    });

    try {
      // Execute test based on method
      if (test.method === TestMethod.AUTOMATED) {
        return await this.executeAutomatedTest(test);
      } else {
        // For manual tests, just mark as in progress
        return test;
      }
    } catch (error) {
      return await this.update(id, {
        status: TestStatus.ERROR,
        testResults: {
          overallResult: 'FAIL',
          steps: [],
          exceptions: [{
            type: 'EXECUTION_ERROR',
            description: error.message,
            impact: 'Test could not be completed',
            approved: false,
          }],
        },
      });
    }
  }

  private async executeAutomatedTest(test: ControlTest): Promise<ControlTest> {
    const control = test.control;
    const automationConfig = control.automationConfig;

    let results: any = {};

    switch (automationConfig?.automationType) {
      case 'SCRIPT':
        results = await this.executeScript(
          automationConfig.scriptId || '',
          automationConfig.parameters || {}
        );
        break;
      case 'API':
        results = await this.executeApiTest(
          automationConfig.apiEndpoint || '',
          automationConfig.parameters || {}
        );
        break;
      case 'INTEGRATION':
        results = await this.executeIntegrationTest(
          automationConfig.integrationId || '',
          automationConfig.parameters || {}
        );
        break;
    }

    // Process results and update test
    const testResults = this.processAutomationResults(results, control.testProcedures);

    return await this.update(test.id, {
      status: testResults.overallResult === 'PASS' ? TestStatus.PASSED : TestStatus.FAILED,
      testResults,
      automationResults: results,
    });
  }

  private async executeScript(scriptId: string, parameters: Record<string, any>): Promise<any> {
    // Implementation would execute the script and return results
    // This is a placeholder
    return {
      success: true,
      output: 'Script executed successfully',
      metrics: {},
    };
  }

  private async executeApiTest(endpoint: string, parameters: Record<string, any>): Promise<any> {
    // Implementation would call the API and validate response
    // This is a placeholder
    return {
      success: true,
      response: {},
      statusCode: 200,
    };
  }

  private async executeIntegrationTest(integrationId: string, parameters: Record<string, any>): Promise<any> {
    // Implementation would use the integration to perform tests
    // This is a placeholder
    return {
      success: true,
      data: {},
    };
  }

  private processAutomationResults(results: AutomationResultData, testProcedures: ControlTestProcedures): AutomationResultData {
    // Process automation results into structured test results
    const steps = testProcedures?.steps || [];
    const processedSteps = steps.map((step: ControlTestStep) => ({
      order: step.order,
      stepNumber: step.order,
      description: step.description,
      result: results.success ? 'PASS' : 'FAIL',
      evidence: results.evidence || [],
      notes: results.notes || '',
      timestamp: new Date(),
      expectedResult: step.expectedResult,
      instructions: step.instructions,
    }));

    return {
      ...results,
      overallResult: results.success ? 'PASS' : 'FAIL',
      steps: processedSteps,
      exceptions: results.exceptions || [],
    };
  }

  async recordTestResults(
    id: string,
    results: AutomationResultData,
    testerId: string
  ): Promise<ControlTest> {
    const test = await this.findOne(id);

    if (test.status !== TestStatus.IN_PROGRESS) {
      throw new Error('Test must be in IN_PROGRESS status to record results');
    }

    const status = results.overallResult === 'PASS' 
      ? TestStatus.PASSED 
      : results.overallResult === 'PARTIAL'
        ? TestStatus.PARTIALLY_PASSED
        : TestStatus.FAILED;

    return await this.update(id, {
      status,
      testResults: results,
      testerId,
    });
  }

  async addFinding(testId: string, finding: ControlTestFinding): Promise<ControlTest> {
    const test = await this.findOne(testId);
    
    test.findings = test.findings || [];
    test.findings.push({
      ...finding,
      id: `FND-${Date.now()}`,
      status: 'OPEN',
    });

    const updatedTest = await this.controlTestRepository.save(test);

    await this.kafkaService.emit(EventType.CONTROL_FINDING_CREATED, {
      findingId: finding.id,
      testId: test.id,
      controlId: test.controlId,
      controlCode: test.control?.code || '',
      organizationId: test.organizationId,
      severity: finding.severity,
      description: finding.description,
      recommendation: finding.recommendation,
    });

    return updatedTest;
  }

  async addEvidence(testId: string, evidence: TestEvidenceData): Promise<ControlTest> {
    const test = await this.findOne(testId);
    
    test.evidence = test.evidence || [];
    test.evidence.push({
      ...evidence,
      id: `EVD-${Date.now()}`,
      collectedAt: new Date(),
      verified: false,
    });

    return await this.controlTestRepository.save(test);
  }

  async reviewTest(
    id: string,
    reviewerId: string,
    reviewNotes: string,
    approved: boolean
  ): Promise<ControlTest> {
    const test = await this.findOne(id);

    if (![TestStatus.PASSED, TestStatus.FAILED, TestStatus.PARTIALLY_PASSED].includes(test.status)) {
      throw new Error('Test must be completed before review');
    }

    const updatedTest = await this.update(id, {
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewerNotes: reviewNotes,
    });

    await this.kafkaService.emit(EventType.CONTROL_TEST_COMPLETED, {
      testId: test.id,
      controlId: test.controlId,
      controlCode: test.control?.code || '',
      organizationId: test.organizationId,
      result: test.status,
      testMethod: test.method,
      testerId: test.testerId,
      findings: test.findings?.length || 0,
      criticalFindings: test.findings?.filter(f => f.severity === 'CRITICAL').length || 0,
    });

    return updatedTest;
  }

  private async emitTestStatusEvent(test: ControlTest) {
    const eventTypeMap: Record<TestStatus, string> = {
      [TestStatus.IN_PROGRESS]: EventType.CONTROL_TEST_STARTED,
      [TestStatus.PASSED]: EventType.CONTROL_TEST_COMPLETED,
      [TestStatus.FAILED]: EventType.CONTROL_TEST_COMPLETED,
      [TestStatus.ERROR]: EventType.CONTROL_TEST_COMPLETED,
      [TestStatus.PARTIALLY_PASSED]: EventType.CONTROL_TEST_COMPLETED,
      [TestStatus.SCHEDULED]: '', // Not used in status events
      [TestStatus.COMPLETED]: EventType.CONTROL_TEST_COMPLETED,
      [TestStatus.NOT_APPLICABLE]: '', // Not used in status events
    };

    const eventType = eventTypeMap[test.status];
    if (eventType) {
      await this.kafkaService.emit(eventType, {
        testId: test.id,
        controlId: test.controlId,
        controlCode: test.control?.code,
        organizationId: test.organizationId,
        result: test.status,
        testMethod: test.method,
        testerId: test.testerId,
        findings: test.findings?.length || 0,
        criticalFindings: test.findings?.filter(f => f.severity === 'CRITICAL').length || 0,
      });
    }
  }

  async getTestMetrics(organizationId: string, period?: string): Promise<any> {
    const dateFilter = this.getDateFilter(period);

    const metrics = await this.controlTestRepository.query(`
      SELECT 
        COUNT(*) as total_tests,
        COUNT(CASE WHEN status = 'PASSED' THEN 1 END) as passed_tests,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_tests,
        COUNT(CASE WHEN status = 'PARTIALLY_PASSED' THEN 1 END) as partial_tests,
        COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as error_tests,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms END) as avg_duration,
        COUNT(DISTINCT control_id) as controls_tested,
        COUNT(DISTINCT tester_id) as unique_testers
      FROM control_tests
      WHERE organization_id = $1
        AND completed_at IS NOT NULL
        ${dateFilter ? 'AND completed_at >= $2' : ''}
    `, dateFilter ? [organizationId, dateFilter] : [organizationId]);

    const findingMetrics = await this.controlTestRepository.query(`
      SELECT 
        jsonb_array_length(findings) as finding_count,
        findings->0->>'severity' as severity
      FROM control_tests
      WHERE organization_id = $1
        AND jsonb_array_length(findings) > 0
        ${dateFilter ? 'AND completed_at >= $2' : ''}
    `, dateFilter ? [organizationId, dateFilter] : [organizationId]);

    return {
      summary: metrics[0],
      successRate: (metrics[0].passed_tests / metrics[0].total_tests) * 100,
      findings: this.aggregateFindingsBySeverity(findingMetrics),
    };
  }

  private getDateFilter(period?: string): Date | null {
    if (!period) return null;

    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.setDate(now.getDate() - 1));
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'quarter':
        return new Date(now.setMonth(now.getMonth() - 3));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return null;
    }
  }

  private aggregateFindingsBySeverity(findings: any[]): Record<string, number> {
    const severityCounts: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    findings.forEach(row => {
      if (row.severity && Object.prototype.hasOwnProperty.call(severityCounts, row.severity)) {
        severityCounts[row.severity] += parseInt(row.finding_count || '0', 10);
      }
    });

    return severityCounts;
  }

  // Inter-service communication methods

  /**
   * Upload test evidence to evidence-service
   */
  async uploadTestEvidence(testId: string, evidenceData: EvidenceValidationData): Promise<string | null> {
    try {
      const test = await this.findOne(testId);
      
      const response = await this.serviceDiscovery.callService(
        'evidence-service',
        'POST',
        '/evidence',
        {
          ...evidenceData,
          controlId: test.controlId,
          testId: testId,
          type: 'test_result',
        },
      );
      
      return (response.data as { id?: string })?.id || null;
    } catch (error) {
      console.error(`Failed to upload evidence for test ${testId}`, error);
      return null;
    }
  }

  /**
   * Request workflow approval for test results
   */
  async requestTestApproval(testId: string, approvalData: ApprovalWorkflowData): Promise<string | null> {
    try {
      const test = await this.findOne(testId);
      
      const response = await this.serviceDiscovery.callService(
        'workflow-service',
        'POST',
        '/workflows/approvals',
        {
          ...approvalData,
          entityType: 'control_test',
          entityId: testId,
          workflowType: 'test_result_approval',
          controlId: test.controlId,
        },
      );
      
      return (response.data as { workflowId?: string })?.workflowId || null;
    } catch (error) {
      console.error(`Failed to request approval for test ${testId}`, error);
      return null;
    }
  }

  /**
   * Complete test with evidence upload and approval request
   */
  async completeTestWithEvidence(
    testId: string,
    testResults: AutomationResultData,
    evidenceData: EvidenceValidationData,
    requiresApproval: boolean = true
  ): Promise<ControlTest> {
    // Update the test with results
    const updatedTest = await this.update(testId, {
      status: TestStatus.COMPLETED,
      testResults: testResults,
    });
    
    // Upload evidence
    const evidenceId = await this.uploadTestEvidence(testId, evidenceData);
    
    // Request approval if required
    if (requiresApproval && testResults.overallResult === 'FAIL') {
      await this.requestTestApproval(testId, {
        entityType: 'control_test',
        entityId: testId,
        workflowType: 'test_result_approval',
        controlId: updatedTest.controlId,
        testResults,
        evidenceId: evidenceId || '',
        reason: 'Test failed and requires management review',
      } as ApprovalWorkflowData);
    }
    
    return updatedTest;
  }

  /**
   * Analyze test coverage for an organization
   */
  async analyzeTestCoverage(organizationId: string): Promise<any> {
    try {
      // Get total controls
      const totalControlsResult = await this.controlTestRepository.query(`
        SELECT COUNT(DISTINCT c.id) as total_controls
        FROM controls c
        INNER JOIN control_implementations ci ON ci.control_id = c.id
        WHERE ci.organization_id = $1 AND c.status = 'ACTIVE'
      `, [organizationId]);

      const totalControls = parseInt(totalControlsResult[0].total_controls || '0');

      // Get tested controls
      const testedControlsResult = await this.controlTestRepository.query(`
        SELECT COUNT(DISTINCT control_id) as tested_controls
        FROM control_tests
        WHERE organization_id = $1
      `, [organizationId]);

      const testedControls = parseInt(testedControlsResult[0].tested_controls || '0');

      // Get test frequency analysis
      const frequencyAnalysis = await this.controlTestRepository.query(`
        SELECT 
          control_id,
          COUNT(*) as test_count,
          MAX(completed_at) as last_test_date,
          AVG(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as success_rate
        FROM control_tests
        WHERE organization_id = $1 AND completed_at IS NOT NULL
        GROUP BY control_id
        ORDER BY test_count DESC
      `, [organizationId]);

      // Identify testing gaps
      const testingGaps = await this.controlTestRepository.query(`
        SELECT 
          c.id,
          c.code,
          c.name,
          c.risk_rating,
          c.frequency
        FROM controls c
        INNER JOIN control_implementations ci ON ci.control_id = c.id
        LEFT JOIN control_tests ct ON ct.control_id = c.id AND ct.organization_id = $1
        WHERE ci.organization_id = $1 AND c.status = 'ACTIVE' AND ct.id IS NULL
        ORDER BY 
          CASE c.risk_rating 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'HIGH' THEN 2 
            WHEN 'MEDIUM' THEN 3 
            ELSE 4 END,
          c.frequency DESC
      `, [organizationId]);

      // Calculate coverage percentage
      const coveragePercentage = totalControls > 0 ? (testedControls / totalControls) * 100 : 0;

      // Determine risk level based on coverage
      let riskLevel = 'LOW';
      if (coveragePercentage < 50) riskLevel = 'CRITICAL';
      else if (coveragePercentage < 70) riskLevel = 'HIGH';
      else if (coveragePercentage < 85) riskLevel = 'MEDIUM';

      return {
        summary: {
          totalControls,
          testedControls,
          coveragePercentage,
          riskLevel,
          untested: totalControls - testedControls,
        },
        frequencyAnalysis: frequencyAnalysis.map((row: any) => ({
          controlId: row.control_id,
          testCount: parseInt(row.test_count),
          lastTestDate: row.last_test_date,
          successRate: parseFloat(row.success_rate) * 100,
        })),
        testingGaps: testingGaps.map((gap: any) => ({
          controlId: gap.id,
          controlCode: gap.code,
          controlName: gap.name,
          riskRating: gap.risk_rating,
          requiredFrequency: gap.frequency,
          priority: gap.risk_rating === 'CRITICAL' ? 'HIGH' : gap.risk_rating === 'HIGH' ? 'MEDIUM' : 'LOW',
        })),
        recommendations: [
          coveragePercentage < 50 ? 'Critical: Immediate testing required for uncovered controls' : null,
          coveragePercentage < 70 ? 'High priority: Expand testing coverage to critical controls' : null,
          testingGaps.length > 0 ? `${testingGaps.length} controls require initial testing` : null,
          frequencyAnalysis.some((f: any) => parseFloat(f.success_rate) < 0.8) ? 'Some controls showing low success rates - review required' : null,
        ].filter(Boolean),
      };
    } catch (error) {
      console.error('Error analyzing test coverage:', error);
      throw new BadRequestException(`Failed to analyze test coverage: ${error.message}`);
    }
  }

  /**
   * Predict test outcomes based on historical data and control characteristics
   */
  async predictTestOutcomes(controlId: string, organizationId: string): Promise<any> {
    try {
      // Get historical test data for this control
      const historicalTests = await this.controlTestRepository.find({
        where: {
          controlId,
          organizationId,
        },
        relations: ['control'],
        order: {
          completedAt: 'DESC',
        },
        take: 20, // Last 20 tests for analysis
      });

      if (historicalTests.length === 0) {
        // No historical data - use control characteristics
        const control = await this.controlsService.findOne(controlId);
        return this.predictBasedOnControlCharacteristics(control);
      }

      // Calculate success rate
      const passedTests = historicalTests.filter(test => test.status === TestStatus.PASSED);
      const successRate = (passedTests.length / historicalTests.length) * 100;

      // Analyze trends
      const recentTests = historicalTests.slice(0, 5);
      const recentSuccessRate = (recentTests.filter(test => test.status === TestStatus.PASSED).length / recentTests.length) * 100;
      
      const trend = recentSuccessRate > successRate ? 'IMPROVING' : 
                   recentSuccessRate < successRate ? 'DECLINING' : 'STABLE';

      // Analyze failure patterns
      const failedTests = historicalTests.filter(test => test.status === TestStatus.FAILED);
      const commonFailureReasons = this.analyzeFailurePatterns(failedTests);

      // Calculate average test duration
      const testsWithDuration = historicalTests.filter(test => test.durationMs);
      const averageDuration = testsWithDuration.length > 0 
        ? testsWithDuration.reduce((sum, test) => sum + test.durationMs, 0) / testsWithDuration.length
        : null;

      // Predict next test outcome
      let predictedOutcome = 'PASS';
      let confidence = 'MEDIUM';

      if (successRate < 50) {
        predictedOutcome = 'FAIL';
        confidence = successRate < 25 ? 'HIGH' : 'MEDIUM';
      } else if (successRate > 85) {
        confidence = 'HIGH';
      }

      // Adjust based on trend
      if (trend === 'DECLINING' && successRate < 70) {
        predictedOutcome = 'FAIL';
        confidence = 'MEDIUM';
      } else if (trend === 'IMPROVING' && successRate > 60) {
        predictedOutcome = 'PASS';
        confidence = successRate > 80 ? 'HIGH' : 'MEDIUM';
      }

      return {
        controlId,
        organizationId,
        prediction: {
          outcome: predictedOutcome,
          confidence,
          successProbability: successRate,
        },
        analysis: {
          historicalTests: historicalTests.length,
          successRate,
          recentSuccessRate,
          trend,
          averageDurationMs: averageDuration,
        },
        riskFactors: {
          lowSuccessRate: successRate < 70,
          decliningTrend: trend === 'DECLINING',
          commonFailures: commonFailureReasons,
          highVariability: this.calculateVariability(historicalTests),
        },
        recommendations: [
          successRate < 50 ? 'High failure risk - review control implementation' : null,
          trend === 'DECLINING' ? 'Declining trend detected - investigate root causes' : null,
          commonFailureReasons.length > 0 ? 'Address common failure patterns before next test' : null,
          averageDuration && averageDuration > 3600000 ? 'Long test duration - consider automation' : null,
        ].filter(Boolean),
      };
    } catch (error) {
      console.error(`Error predicting test outcomes for control ${controlId}:`, error);
      throw new BadRequestException(`Failed to predict test outcomes: ${error.message}`);
    }
  }

  private predictBasedOnControlCharacteristics(control: any): any {
    let successProbability = 70; // Default
    let confidence = 'LOW';
    
    // Adjust based on control characteristics
    if (control.automationLevel === 'FULLY_AUTOMATED') {
      successProbability += 20;
      confidence = 'MEDIUM';
    } else if (control.automationLevel === 'MANUAL') {
      successProbability -= 15;
    }

    if (control.complexity === 'HIGH') {
      successProbability -= 20;
    } else if (control.complexity === 'LOW') {
      successProbability += 10;
    }

    if (control.riskRating === 'CRITICAL' || control.riskRating === 'HIGH') {
      // High-risk controls get more attention, slightly higher success rate
      successProbability += 5;
    }

    const predictedOutcome = successProbability > 60 ? 'PASS' : 'FAIL';
    
    return {
      controlId: control.id,
      prediction: {
        outcome: predictedOutcome,
        confidence,
        successProbability,
      },
      analysis: {
        historicalTests: 0,
        basedOnCharacteristics: true,
      },
      riskFactors: {
        noHistoricalData: true,
        highComplexity: control.complexity === 'HIGH',
        manualProcess: control.automationLevel === 'MANUAL',
      },
      recommendations: [
        'No historical data - prediction based on control characteristics',
        control.complexity === 'HIGH' ? 'High complexity control - ensure thorough preparation' : null,
        control.automationLevel === 'MANUAL' ? 'Manual control - provide clear test procedures' : null,
      ].filter(Boolean),
    };
  }

  private analyzeFailurePatterns(failedTests: any[]): string[] {
    const patterns: string[] = [];
    
    if (failedTests.length === 0) return patterns;
    
    // Look for common failure reasons in findings
    const allFindings = failedTests.flatMap(test => test.findings || []);
    const failureReasons = new Map<string, number>();
    
    allFindings.forEach(finding => {
      if (finding.description) {
        const key = finding.description.toLowerCase();
        failureReasons.set(key, (failureReasons.get(key) || 0) + 1);
      }
    });
    
    // Find patterns that appear in multiple tests
    const threshold = Math.max(2, Math.ceil(failedTests.length * 0.3));
    for (const [reason, count] of failureReasons.entries()) {
      if (count >= threshold) {
        patterns.push(reason);
      }
    }
    
    return patterns.slice(0, 3); // Top 3 patterns
  }

  private calculateVariability(tests: any[]): boolean {
    if (tests.length < 3) return false;
    
    const outcomes = tests.map(test => test.status === TestStatus.PASSED ? 1 : 0);
    const mean = outcomes.reduce((sum: number, val: number) => sum + val, 0) / outcomes.length;
    const variance = outcomes.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / outcomes.length;
    
    // High variability if variance > 0.2 (arbitrary threshold)
    return variance > 0.2;
  }
}