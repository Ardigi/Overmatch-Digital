import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ReportStorageService } from './report-storage.service';

jest.mock('fs/promises');

describe('ReportStorageService', () => {
  let service: ReportStorageService;
  let configService: any;

  const mockFsPromises = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    // Create mocks
    configService = {
      get: jest.fn(),
    };

    // Setup default config values BEFORE instantiation
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        'storage.reportsPath': './storage/reports',
        'storage.baseUrl': 'http://localhost:3000',
      };
      return config[key] || defaultValue;
    });

    // Manual instantiation AFTER mock is configured
    service = new ReportStorageService(configService);

    jest.clearAllMocks();

    // Re-setup config values after clearAllMocks
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        'storage.reportsPath': './storage/reports',
        'storage.baseUrl': 'http://localhost:3000',
      };
      return config[key] || defaultValue;
    });

    // Mock fs methods
    mockFsPromises.mkdir.mockResolvedValue(undefined);
    mockFsPromises.writeFile.mockResolvedValue(undefined);
    mockFsPromises.readFile.mockResolvedValue(Buffer.from('File content'));
    mockFsPromises.unlink.mockResolvedValue(undefined);
    mockFsPromises.readdir.mockResolvedValue([]);
    mockFsPromises.stat.mockResolvedValue({
      size: 1024,
      mtime: new Date('2024-01-15'),
    } as any);
  });

  describe('store', () => {
    it('should store report file successfully', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        content: Buffer.from('PDF content'),
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
      };

      const result = await service.store(options);

      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(path.join('storage', 'reports', 'org-123')),
        { recursive: true }
      );

      // Verify file writing
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('report_'),
        options.content
      );

      // Verify result
      expect(result).toMatchObject({
        fileUrl: expect.stringContaining('http://localhost:3000/api/v1/reports/download/'),
        fileName: expect.stringMatching(/report_\d+_[a-f0-9]{8}\.pdf/),
        fileSize: 11, // 'PDF content'.length
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        storagePath: expect.stringContaining('report_'),
      });
    });

    it('should organize files by year and month', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        content: Buffer.from('Content'),
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
      };

      const currentDate = new Date();
      const year = currentDate.getFullYear().toString();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');

      await service.store(options);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(path.join('org-123', year, month)),
        { recursive: true }
      );
    });

    it('should generate unique filename with timestamp and hash', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        content: Buffer.from('Content'),
        fileName: 'original_name.pdf',
        mimeType: 'application/pdf',
      };

      const beforeTimestamp = Date.now();
      const result = await service.store(options);
      const afterTimestamp = Date.now();

      // Extract timestamp from filename
      const match = result.fileName.match(/report_(\d+)_[a-f0-9]{8}\.pdf/);
      expect(match).toBeTruthy();

      const fileTimestamp = parseInt(match![1]);
      expect(fileTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(fileTimestamp).toBeLessThanOrEqual(afterTimestamp);

      // Verify hash is based on reportId
      const expectedHash = crypto
        .createHash('md5')
        .update('report-123')
        .digest('hex')
        .substring(0, 8);
      expect(result.fileName).toContain(expectedHash);
    });

    it('should calculate SHA256 checksum', async () => {
      const content = Buffer.from('Test content for checksum');
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        content,
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
      };

      const result = await service.store(options);

      const expectedChecksum = crypto.createHash('sha256').update(content).digest('hex');
      expect(result.checksum).toBe(expectedChecksum);
    });

    it('should handle storage errors', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        content: Buffer.from('Content'),
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
      };

      mockFsPromises.writeFile.mockRejectedValueOnce(new Error('Disk full'));

      await expect(service.store(options)).rejects.toThrow('Disk full');
    });

    it('should handle different file extensions', async () => {
      const testCases = [
        { fileName: 'report.pdf', expectedExt: '.pdf' },
        { fileName: 'report.xlsx', expectedExt: '.xlsx' },
        { fileName: 'report.docx', expectedExt: '.docx' },
        { fileName: 'report', expectedExt: '' },
      ];

      for (const { fileName, expectedExt } of testCases) {
        const options = {
          reportId: 'report-123',
          organizationId: 'org-123',
          content: Buffer.from('Content'),
          fileName,
          mimeType: 'application/octet-stream',
        };

        const result = await service.store(options);
        expect(result.fileName).toMatch(new RegExp(`report_\\d+_[a-f0-9]{8}${expectedExt}$`));
      }
    });
  });

  describe('storeTemporary', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(global, 'setTimeout');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should store temporary file', async () => {
      const options = {
        content: Buffer.from('Temporary content'),
        fileName: 'preview.pdf',
        mimeType: 'application/pdf',
      };

      const result = await service.storeTemporary(options);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(path.join('storage', 'reports', 'temp')),
        { recursive: true }
      );

      expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('temp_'), options.content);

      expect(result).toMatch(
        /http:\/\/localhost:3000\/api\/v1\/reports\/preview\/temp_\d+_preview\.pdf/
      );
    });

    it('should schedule deletion when expiresIn is provided', async () => {
      const options = {
        content: Buffer.from('Temporary content'),
        fileName: 'preview.pdf',
        mimeType: 'application/pdf',
        expiresIn: 3600, // 1 hour
      };

      await service.storeTemporary(options);

      // Verify setTimeout was called
      expect(setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        3600000 // 3600 * 1000
      );

      // Fast-forward time and verify deletion
      jest.advanceTimersByTime(3600000);
      await Promise.resolve(); // Let async callbacks execute

      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('temp_'));
    });

    it('should handle deletion errors silently', async () => {
      const options = {
        content: Buffer.from('Temporary content'),
        fileName: 'preview.pdf',
        mimeType: 'application/pdf',
        expiresIn: 1,
      };

      mockFsPromises.unlink.mockRejectedValueOnce(new Error('File not found'));

      await service.storeTemporary(options);

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // Should not throw error
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('retrieve', () => {
    it('should retrieve file successfully', async () => {
      const filePath = 'org-123/2024/01/report_123_abc.pdf';
      const expectedContent = Buffer.from('Retrieved content');
      mockFsPromises.readFile.mockResolvedValueOnce(expectedContent);

      const result = await service.retrieve(filePath);

      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining(path.join('storage', 'reports', filePath))
      );
      expect(result).toEqual(expectedContent);
    });

    it('should prevent directory traversal attacks', async () => {
      const maliciousPath = '../../../etc/passwd';

      await expect(service.retrieve(maliciousPath)).rejects.toThrow('Invalid file path');
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should handle file not found', async () => {
      const filePath = 'org-123/2024/01/non-existent.pdf';
      mockFsPromises.readFile.mockRejectedValueOnce(new Error('ENOENT: no such file'));

      await expect(service.retrieve(filePath)).rejects.toThrow('ENOENT: no such file');
    });

    it('should handle absolute paths within storage directory', async () => {
      const basePath = path.resolve('./storage/reports');
      const validPath = 'org-123/report.pdf';

      // The service should accept valid relative paths
      await service.retrieve(validPath);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining(path.join('storage', 'reports', validPath))
      );
    });
  });

  describe('delete', () => {
    it('should delete file successfully', async () => {
      const filePath = 'org-123/2024/01/report_123_abc.pdf';

      await service.delete(filePath);

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining(path.join('storage', 'reports', filePath))
      );
    });

    it('should prevent directory traversal in delete', async () => {
      const maliciousPath = '../../../important/file.txt';

      await expect(service.delete(maliciousPath)).rejects.toThrow('Invalid file path');
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const filePath = 'org-123/2024/01/report.pdf';
      mockFsPromises.unlink.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(service.delete(filePath)).rejects.toThrow('Permission denied');
    });
  });

  describe('getStorageStats', () => {
    it('should calculate storage statistics for organization', async () => {
      const mockFiles = [
        { name: 'file1.pdf', isDirectory: () => false },
        { name: 'file2.pdf', isDirectory: () => false },
        { name: '2024', isDirectory: () => true },
      ];

      const mockSubFiles = [{ name: 'file3.pdf', isDirectory: () => false }];

      mockFsPromises.readdir
        .mockResolvedValueOnce(mockFiles as any)
        .mockResolvedValueOnce(mockSubFiles as any);

      mockFsPromises.stat
        .mockResolvedValueOnce({ size: 1024, mtime: new Date('2024-01-01') } as any)
        .mockResolvedValueOnce({ size: 2048, mtime: new Date('2024-01-15') } as any)
        .mockResolvedValueOnce({ size: 512, mtime: new Date('2024-01-10') } as any);

      const result = await service.getStorageStats('org-123');

      expect(result).toMatchObject({
        totalFiles: 3,
        totalSize: 3584, // 1024 + 2048 + 512
        sizeFormatted: '3.5 KB',
        oldestFile: new Date('2024-01-01'),
        newestFile: new Date('2024-01-15'),
      });
    });

    it('should handle empty directory', async () => {
      mockFsPromises.readdir.mockResolvedValueOnce([]);

      const result = await service.getStorageStats('org-123');

      expect(result).toMatchObject({
        totalFiles: 0,
        totalSize: 0,
        sizeFormatted: '0 B',
        oldestFile: null,
        newestFile: null,
      });
    });

    it('should handle non-existent directory', async () => {
      mockFsPromises.readdir.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await service.getStorageStats('non-existent-org');

      expect(result).toMatchObject({
        totalFiles: 0,
        totalSize: 0,
        sizeFormatted: '0 B',
      });
    });

    it('should recursively calculate stats for subdirectories', async () => {
      const mockRootFiles = [{ name: '2024', isDirectory: () => true }];

      const mockYearFiles = [
        { name: '01', isDirectory: () => true },
        { name: '02', isDirectory: () => true },
      ];

      const mockMonthFiles = [
        { name: 'report1.pdf', isDirectory: () => false },
        { name: 'report2.pdf', isDirectory: () => false },
      ];

      mockFsPromises.readdir
        .mockResolvedValueOnce(mockRootFiles as any)
        .mockResolvedValueOnce(mockYearFiles as any)
        .mockResolvedValueOnce(mockMonthFiles as any)
        .mockResolvedValueOnce(mockMonthFiles as any);

      mockFsPromises.stat.mockResolvedValue({
        size: 1024,
        mtime: new Date('2024-01-15'),
      } as any);

      const result = await service.getStorageStats('org-123');

      expect(result.totalFiles).toBe(4); // 2 files in each month
      expect(result.totalSize).toBe(4096); // 4 * 1024
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      const testCases = [
        { bytes: 0, expected: '0 B' },
        { bytes: 512, expected: '512 B' },
        { bytes: 1024, expected: '1 KB' },
        { bytes: 1536, expected: '1.5 KB' },
        { bytes: 1048576, expected: '1 MB' },
        { bytes: 1073741824, expected: '1 GB' },
        { bytes: 1099511627776, expected: '1 TB' },
      ];

      for (const { bytes, expected } of testCases) {
        const result = (service as any).formatBytes(bytes);
        expect(result).toBe(expected);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        content: Buffer.from(''),
        fileName: 'empty.pdf',
        mimeType: 'application/pdf',
      };

      const result = await service.store(options);

      expect(result.fileSize).toBe(0);
      expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), options.content);
    });

    it('should handle very large files', async () => {
      const largeContent = Buffer.alloc(100 * 1024 * 1024); // 100MB
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        content: largeContent,
        fileName: 'large.pdf',
        mimeType: 'application/pdf',
      };

      const result = await service.store(options);

      expect(result.fileSize).toBe(100 * 1024 * 1024);
      expect((service as any).formatBytes(result.fileSize)).toBe('100 MB');
    });

    it('should handle special characters in filenames', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        content: Buffer.from('Content'),
        fileName: 'report with spaces & special@chars!.pdf',
        mimeType: 'application/pdf',
      };

      const result = await service.store(options);

      // Filename should be sanitized to safe format
      expect(result.fileName).toMatch(/^report_\d+_[a-f0-9]{8}\.pdf$/);
      expect(result.fileName).not.toContain(' ');
      expect(result.fileName).not.toContain('&');
      expect(result.fileName).not.toContain('@');
    });

    it('should handle concurrent operations', async () => {
      const operations = Array(10)
        .fill(null)
        .map((_, i) => ({
          reportId: `report-${i}`,
          organizationId: 'org-123',
          content: Buffer.from(`Content ${i}`),
          fileName: `report${i}.pdf`,
          mimeType: 'application/pdf',
        }));

      const results = await Promise.all(operations.map((options) => service.store(options)));

      expect(results).toHaveLength(10);
      // All filenames should be unique
      const filenames = results.map((r) => r.fileName);
      expect(new Set(filenames).size).toBe(10);
    });
  });

  describe('Configuration', () => {
    it('should use custom storage path from config', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'storage.reportsPath') return '/custom/path/reports';
        if (key === 'storage.baseUrl') return 'https://cdn.example.com';
        return defaultValue;
      });

      const customService = new ReportStorageService(configService as any);

      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        content: Buffer.from('Content'),
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
      };

      const result = await customService.store(options);

      expect(result.fileUrl).toContain('https://cdn.example.com');
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('custom'), { recursive: true });
    });
  });
});
