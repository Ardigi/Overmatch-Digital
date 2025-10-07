import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { ControlTestsService } from './control-tests.service';

@Processor('control-tests')
export class ControlTestProcessor {
  constructor(private readonly controlTestsService: ControlTestsService) {}

  @Process('execute-test')
  async handleTestExecution(job: Job) {
    const { testId, controlId, automationConfig } = job.data;

    try {
      // Execute the automated test
      await this.controlTestsService.executeTest(testId, 'SYSTEM');

      return {
        success: true,
        testId,
        controlId,
      };
    } catch (error) {
      console.error('Test execution failed:', error);
      throw error;
    }
  }
}
