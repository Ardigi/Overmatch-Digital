import { Injectable } from '@nestjs/common';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { ControlsService } from '../controls/controls.service';

@Injectable()
export class MappingService {
  constructor(
    private readonly controlsService: ControlsService,
    private readonly serviceDiscovery: ServiceDiscoveryService
  ) {}

  async mapControlsToFramework(sourceFramework: string, targetFramework: string): Promise<any> {
    // Get controls for source framework
    const sourceControls = await this.controlsService.getControlsByFramework(sourceFramework);

    // Map controls to target framework
    const mappings = sourceControls.map((control) => {
      const targetFrameworkMapping = control.frameworks.find((f) => f.name === targetFramework);

      return {
        sourceControl: {
          id: control.id,
          code: control.code,
          name: control.name,
          framework: sourceFramework,
        },
        targetControl: targetFrameworkMapping
          ? {
              reference: targetFrameworkMapping.reference,
              requirement: targetFrameworkMapping.requirements,
            }
          : null,
        mappingConfidence: targetFrameworkMapping ? 'HIGH' : 'NONE',
      };
    });

    return {
      sourceFramework,
      targetFramework,
      totalControls: sourceControls.length,
      mappedControls: mappings.filter((m) => m.targetControl).length,
      unmappedControls: mappings.filter((m) => !m.targetControl).length,
      mappings,
    };
  }

  async generateCrossReferenceMatrix(frameworks: string[]): Promise<Record<string, any>> {
    const matrix: Record<string, Record<string, any[]>> = {};

    for (const framework of frameworks) {
      matrix[framework] = {};
      const controls = await this.controlsService.getControlsByFramework(framework);

      for (const control of controls) {
        for (const fw of control.frameworks) {
          if (frameworks.includes(fw.name)) {
            if (!matrix[framework][fw.name]) {
              matrix[framework][fw.name] = [];
            }
            matrix[framework][fw.name].push({
              controlId: control.id,
              controlCode: control.code,
              reference: fw.reference,
            });
          }
        }
      }
    }

    return matrix;
  }

  async findGapsBetweenFrameworks(currentFramework: string, targetFramework: string): Promise<any> {
    const currentControls = await this.controlsService.getControlsByFramework(currentFramework);
    const targetControls = await this.controlsService.getControlsByFramework(targetFramework);

    const currentControlIds = new Set(currentControls.map((c) => c.id));
    const gaps = targetControls.filter((control) => !currentControlIds.has(control.id));

    return {
      currentFramework,
      targetFramework,
      currentControlCount: currentControls.length,
      targetControlCount: targetControls.length,
      gapCount: gaps.length,
      gaps: gaps.map((control) => ({
        id: control.id,
        code: control.code,
        name: control.name,
        type: control.type,
        category: control.category,
      })),
    };
  }

  // Inter-service communication methods

  /**
   * Get policy mappings from policy-service
   */
  async getPolicyMappings(frameworkIds: string[]): Promise<any> {
    try {
      const response = await this.serviceDiscovery.callService(
        'policy-service',
        'POST',
        '/policies/mappings/batch',
        { frameworkIds }
      );
      return response.data || [];
    } catch (error) {
      console.error('Failed to get policy mappings', error);
      return [];
    }
  }

  /**
   * Enhanced framework mapping with policy data
   */
  async mapControlsToFrameworkWithPolicies(
    sourceFramework: string,
    targetFramework: string
  ): Promise<any> {
    const basicMapping = await this.mapControlsToFramework(sourceFramework, targetFramework);

    // Get related policies from policy-service
    const controlIds = basicMapping.mappings.map((m: any) => m.sourceControl.id);

    try {
      const policyMappings = await this.serviceDiscovery.callService(
        'policy-service',
        'POST',
        '/policies/mappings/controls',
        { controlIds }
      );

      // Enhance mappings with policy data
      if (policyMappings.success && policyMappings.data) {
        basicMapping.mappings = basicMapping.mappings.map((mapping: any) => ({
          ...mapping,
          relatedPolicies: (policyMappings.data as Record<string, any>)[mapping.sourceControl.id] || [],
        }));
      }
    } catch (error) {
      console.error('Failed to enhance mapping with policy data', error);
    }

    return basicMapping;
  }

  /**
   * Sync control mappings with policy service
   */
  async syncWithPolicyService(controlId: string, frameworkMappings: any[]): Promise<boolean> {
    try {
      const response = await this.serviceDiscovery.callService(
        'policy-service',
        'PUT',
        `/policies/mappings/control/${controlId}`,
        { frameworkMappings }
      );
      return response.success;
    } catch (error) {
      console.error(`Failed to sync control ${controlId} with policy service`, error);
      return false;
    }
  }
}
