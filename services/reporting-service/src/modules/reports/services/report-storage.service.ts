import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface StoreOptions {
  reportId: string;
  organizationId: string;
  content: Buffer;
  fileName: string;
  mimeType: string;
}

export interface StoreResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  checksum: string;
  storagePath: string;
}

export interface StoreTempOptions {
  content: Buffer;
  fileName: string;
  mimeType: string;
  expiresIn?: number; // seconds
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  sizeFormatted: string;
  oldestFile: Date | null;
  newestFile: Date | null;
}

@Injectable()
export class ReportStorageService {
  private readonly logger = new Logger(ReportStorageService.name);
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const reportsPath =
      this.configService.get<string>('storage.reportsPath') || './storage/reports';
    this.basePath = path.resolve(reportsPath);
    this.baseUrl = this.configService.get<string>('storage.baseUrl') || 'http://localhost:3000';
  }

  async store(options: StoreOptions): Promise<StoreResult> {
    try {
      // Create directory structure: org/year/month
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const dirPath = path.join(this.basePath, options.organizationId, year, month);

      await fs.mkdir(dirPath, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const hash = crypto.createHash('md5').update(options.reportId).digest('hex').substring(0, 8);
      const extension = path.extname(options.fileName) || '';
      const uniqueFileName = `report_${timestamp}_${hash}${extension}`;

      const filePath = path.join(dirPath, uniqueFileName);
      const relativePath = path.relative(this.basePath, filePath).replace(/\\/g, '/');

      // Write file
      await fs.writeFile(filePath, options.content);

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(options.content).digest('hex');

      // Generate file URL
      const fileUrl = `${this.baseUrl}/api/v1/reports/download/${options.reportId}`;

      return {
        fileUrl,
        fileName: uniqueFileName,
        fileSize: options.content.length,
        checksum,
        storagePath: relativePath,
      };
    } catch (error) {
      this.logger.error('Failed to store report file', error);
      throw error;
    }
  }

  async storeTemporary(options: StoreTempOptions): Promise<string> {
    try {
      // Create temp directory
      const tempDir = path.join(this.basePath, 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      // Generate temp filename
      const timestamp = Date.now();
      const tempFileName = `temp_${timestamp}_${options.fileName}`;
      const tempPath = path.join(tempDir, tempFileName);

      // Write file
      await fs.writeFile(tempPath, options.content);

      // Schedule deletion if expiresIn is specified
      if (options.expiresIn) {
        setTimeout(async () => {
          try {
            await fs.unlink(tempPath);
            this.logger.debug(`Deleted temporary file: ${tempFileName}`);
          } catch (error) {
            this.logger.warn(`Failed to delete temporary file: ${tempFileName}`, error);
          }
        }, options.expiresIn * 1000);
      }

      // Return preview URL
      return `${this.baseUrl}/api/v1/reports/preview/${tempFileName}`;
    } catch (error) {
      this.logger.error('Failed to store temporary file', error);
      throw error;
    }
  }

  async retrieve(filePath: string): Promise<Buffer> {
    try {
      // Validate path to prevent directory traversal
      if (filePath.includes('..') || path.isAbsolute(filePath)) {
        throw new Error('Invalid file path');
      }

      const fullPath = path.join(this.basePath, filePath);

      // Ensure the resolved path is within the base path
      const resolvedPath = path.resolve(fullPath);
      const resolvedBasePath = path.resolve(this.basePath);

      if (!resolvedPath.startsWith(resolvedBasePath)) {
        throw new Error('Invalid file path');
      }

      return await fs.readFile(fullPath);
    } catch (error) {
      this.logger.error(`Failed to retrieve file: ${filePath}`, error);
      throw error;
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      // Validate path to prevent directory traversal
      if (filePath.includes('..') || path.isAbsolute(filePath)) {
        throw new Error('Invalid file path');
      }

      const fullPath = path.join(this.basePath, filePath);

      // Ensure the resolved path is within the base path
      const resolvedPath = path.resolve(fullPath);
      const resolvedBasePath = path.resolve(this.basePath);

      if (!resolvedPath.startsWith(resolvedBasePath)) {
        throw new Error('Invalid file path');
      }

      await fs.unlink(fullPath);
      this.logger.debug(`Deleted file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filePath}`, error);
      throw error;
    }
  }

  async getStorageStats(organizationId: string): Promise<StorageStats> {
    try {
      const orgPath = path.join(this.basePath, organizationId);

      const stats: StorageStats = {
        totalFiles: 0,
        totalSize: 0,
        sizeFormatted: '0 B',
        oldestFile: null,
        newestFile: null,
      };

      // Check if directory exists
      try {
        await fs.access(orgPath);
      } catch {
        return stats;
      }

      // Recursively get all files
      const files = await this.getAllFiles(orgPath);

      if (files.length === 0) {
        return stats;
      }

      // Calculate stats
      let oldestTime = Infinity;
      let newestTime = 0;

      for (const file of files) {
        const fileStat = await fs.stat(file);
        stats.totalFiles++;
        stats.totalSize += fileStat.size;

        const mtime = fileStat.mtime.getTime();
        if (mtime < oldestTime) {
          oldestTime = mtime;
          stats.oldestFile = fileStat.mtime;
        }
        if (mtime > newestTime) {
          newestTime = mtime;
          stats.newestFile = fileStat.mtime;
        }
      }

      stats.sizeFormatted = this.formatBytes(stats.totalSize);

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get storage stats for org ${organizationId}`, error);
      return {
        totalFiles: 0,
        totalSize: 0,
        sizeFormatted: '0 B',
        oldestFile: null,
        newestFile: null,
      };
    }
  }

  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to read directory: ${dirPath}`, error);
    }

    return files;
  }

  private formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / k ** i).toFixed(dm)) + ' ' + sizes[i];
  }
}
