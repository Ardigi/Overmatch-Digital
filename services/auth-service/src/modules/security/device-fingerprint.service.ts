import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { UAParser } from 'ua-parser-js';

export interface DeviceFingerprint {
  hash: string;
  components: {
    userAgent: string;
    browser: {
      name?: string;
      version?: string;
    };
    os: {
      name?: string;
      version?: string;
    };
    device: {
      type?: string;
      vendor?: string;
      model?: string;
    };
    screenResolution?: string;
    timezone?: string;
    language?: string;
    colorDepth?: number;
    hardwareConcurrency?: number;
    platform?: string;
    plugins?: string[];
    canvas?: string;
    webgl?: string;
    fonts?: string[];
    audio?: string;
  };
  trustScore: number;
  createdAt: Date;
}

export interface FingerprintRequest {
  userAgent: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
  clientData?: {
    screenResolution?: string;
    timezone?: string;
    language?: string;
    colorDepth?: number;
    hardwareConcurrency?: number;
    platform?: string;
    plugins?: string[];
    canvas?: string;
    webgl?: string;
    fonts?: string[];
    audio?: string;
  };
}

@Injectable()
export class DeviceFingerprintService {
  private uaParser: UAParser;

  constructor() {
    this.uaParser = new UAParser();
  }

  generateFingerprint(request: FingerprintRequest): DeviceFingerprint {
    const ua = this.uaParser.setUA(request.userAgent).getResult();

    const components = {
      userAgent: request.userAgent,
      browser: {
        name: ua.browser.name,
        version: ua.browser.version,
      },
      os: {
        name: ua.os.name,
        version: ua.os.version,
      },
      device: {
        type: ua.device.type,
        vendor: ua.device.vendor,
        model: ua.device.model,
      },
      ...request.clientData,
    };

    // Calculate hash
    const hash = this.calculateHash(components);

    // Calculate trust score
    const trustScore = this.calculateTrustScore(components);

    return {
      hash,
      components,
      trustScore,
      createdAt: new Date(),
    };
  }

  private calculateHash(components: any): string {
    // Create stable string representation
    const fingerprintData = [
      components.browser?.name || '',
      components.browser?.version?.split('.')[0] || '', // Major version only
      components.os?.name || '',
      components.os?.version?.split('.')[0] || '', // Major version only
      components.device?.type || '',
      components.screenResolution || '',
      components.timezone || '',
      components.language || '',
      components.colorDepth || '',
      components.hardwareConcurrency || '',
      components.platform || '',
      components.canvas || '',
      components.webgl || '',
    ].join('|');

    return crypto.createHash('sha256').update(fingerprintData).digest('hex').substring(0, 32);
  }

  private calculateTrustScore(components: any): number {
    let score = 0;
    const maxScore = 100;

    // User agent analysis (20 points)
    if (components.userAgent && !this.isSuspiciousUserAgent(components.userAgent)) {
      score += 20;
    }

    // Browser information (15 points)
    if (components.browser?.name && this.isKnownBrowser(components.browser.name)) {
      score += 15;
    }

    // OS information (15 points)
    if (components.os?.name && this.isKnownOS(components.os.name)) {
      score += 15;
    }

    // Screen resolution (10 points)
    if (components.screenResolution && this.isValidResolution(components.screenResolution)) {
      score += 10;
    }

    // Language and timezone consistency (10 points)
    if (components.language && components.timezone) {
      score += 10;
    }

    // Hardware concurrency (10 points)
    if (
      components.hardwareConcurrency &&
      components.hardwareConcurrency > 0 &&
      components.hardwareConcurrency <= 16
    ) {
      score += 10;
    }

    // Canvas fingerprint (10 points)
    if (components.canvas && components.canvas.length > 20) {
      score += 10;
    }

    // WebGL data (10 points)
    if (components.webgl && components.webgl.length > 10) {
      score += 10;
    }

    return Math.min(score, maxScore);
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /phantom/i,
      /headless/i,
      /electron/i,
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  private isKnownBrowser(browser: string): boolean {
    const knownBrowsers = [
      'Chrome',
      'Firefox',
      'Safari',
      'Edge',
      'Opera',
      'Samsung Browser',
      'UC Browser',
    ];

    return knownBrowsers.includes(browser);
  }

  private isKnownOS(os: string): boolean {
    const knownOS = [
      'Windows',
      'Mac OS',
      'macOS',
      'Linux',
      'Android',
      'iOS',
      'Ubuntu',
      'Debian',
      'Fedora',
      'CentOS',
    ];

    return knownOS.includes(os);
  }

  private isValidResolution(resolution: string): boolean {
    const resolutionPattern = /^\d{3,4}x\d{3,4}$/;
    return resolutionPattern.test(resolution);
  }

  compareFingerprints(fp1: DeviceFingerprint, fp2: DeviceFingerprint): number {
    // Simple similarity score (0-100)
    let similarity = 0;
    const weights = {
      hash: 40,
      browser: 15,
      os: 15,
      device: 10,
      screenResolution: 10,
      timezone: 5,
      language: 5,
    };

    if (fp1.hash === fp2.hash) {
      similarity += weights.hash;
    }

    if (fp1.components.browser?.name === fp2.components.browser?.name) {
      similarity += weights.browser;
    }

    if (fp1.components.os?.name === fp2.components.os?.name) {
      similarity += weights.os;
    }

    if (fp1.components.device?.type === fp2.components.device?.type) {
      similarity += weights.device;
    }

    if (fp1.components.screenResolution === fp2.components.screenResolution) {
      similarity += weights.screenResolution;
    }

    if (fp1.components.timezone === fp2.components.timezone) {
      similarity += weights.timezone;
    }

    if (fp1.components.language === fp2.components.language) {
      similarity += weights.language;
    }

    return similarity;
  }

  detectAnomalies(fingerprint: DeviceFingerprint): string[] {
    const anomalies: string[] = [];

    // Check for headless browser indicators
    if (!fingerprint.components.plugins || fingerprint.components.plugins.length === 0) {
      anomalies.push('No plugins detected (possible headless browser)');
    }

    // Check for automation tools
    if (fingerprint.components.webgl && fingerprint.components.webgl.includes('SwiftShader')) {
      anomalies.push('SwiftShader detected (possible automation)');
    }

    // Check for inconsistent hardware
    if (
      fingerprint.components.hardwareConcurrency === 1 &&
      fingerprint.components.platform?.includes('64')
    ) {
      anomalies.push('Single core on 64-bit system (unusual)');
    }

    // Check for missing expected features
    if (!fingerprint.components.canvas) {
      anomalies.push('Canvas fingerprint missing');
    }

    // Check for suspicious user agent
    if (this.isSuspiciousUserAgent(fingerprint.components.userAgent)) {
      anomalies.push('Suspicious user agent detected');
    }

    // Check trust score
    if (fingerprint.trustScore < 50) {
      anomalies.push('Low trust score');
    }

    return anomalies;
  }
}
