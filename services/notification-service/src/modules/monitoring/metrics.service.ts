import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private metrics: Map<string, any> = new Map();

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + 1);
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const current = this.metrics.get(key) || [];
    current.push(value);
    this.metrics.set(key, current);
  }

  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.metrics.set(key, value);
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  getMetrics(): Map<string, any> {
    return this.metrics;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}