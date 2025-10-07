import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { CreateEvidenceDto } from '../../evidence/dto/create-evidence.dto';
import {
  type Evidence,
  EvidenceSource,
  type EvidenceType,
} from '../../evidence/entities/evidence.entity';
import type { EvidenceService } from '../../evidence/evidence.service';

interface CollectorEvidenceData {
  controlId: string;
  organizationId: string;
  type: EvidenceType;
  title: string;
  description: string;
  data: any;
  source: EvidenceSource;
  collectorType: string;
  metadata?: any;
}

@Injectable()
export class CollectorEvidenceService {
  private readonly evidenceStoragePath: string;

  constructor(
    private readonly evidenceService: EvidenceService,
    private readonly configService: ConfigService
  ) {
    this.evidenceStoragePath =
      this.configService.get<string>('EVIDENCE_STORAGE_PATH') || './storage/evidence';
  }

  async createCollectorEvidence(data: CollectorEvidenceData): Promise<Evidence> {
    // Ensure storage directory exists
    await this.ensureStorageDirectory();

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${data.collectorType}-${data.type}-${timestamp}.json`;
    const filePath = path.join(this.evidenceStoragePath, data.organizationId, fileName);

    // Write data to file
    await this.writeDataToFile(filePath, data.data);

    // Calculate file size
    const fileSize = Buffer.byteLength(JSON.stringify(data.data));

    // Create evidence record
    const createEvidenceDto: CreateEvidenceDto & { createdBy: string } = {
      clientId: data.organizationId, // organizationId maps to clientId in Evidence entity
      controlId: data.controlId,
      type: data.type,
      title: data.title,
      description: data.description,
      source: data.source,
      fileName,
      fileSize,
      mimeType: 'application/json',
      collectedBy: 'system',
      createdBy: 'system',
      collectorType: data.collectorType,
      storageUrl: filePath,
      storageProvider: 'local',
      storagePath: filePath,
      collectionDate: new Date().toISOString(),
      metadata: {
        ...data.metadata,
        collectionMethod: EvidenceSource.AUTOMATED_COLLECTION,
        collectionParameters: {
          collectorType: data.collectorType,
          timestamp: new Date().toISOString(),
        },
      },
    };

    return await this.evidenceService.create(createEvidenceDto);
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.evidenceStoragePath, { recursive: true });
    } catch (_error) {}
  }

  private async writeDataToFile(filePath: string, data: any): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async getCollectorEvidenceData(evidenceId: string): Promise<any> {
    const evidence = await this.evidenceService.findOne(evidenceId);

    if (!evidence.storageUrl) {
      throw new Error('Evidence does not have a storage URL');
    }

    try {
      const data = await fs.readFile(evidence.storageUrl, 'utf-8');
      return JSON.parse(data);
    } catch (_error) {
      throw new Error('Failed to retrieve evidence data');
    }
  }
}
