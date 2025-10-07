// Type definitions for packages that don't have complete types

declare module 'winston-elasticsearch' {
  import Transport from 'winston-transport';

  export interface ElasticsearchTransportOptions {
    level?: string;
    clientOpts: {
      node: string;
      [key: string]: any;
    };
    index?: string;
    format?: any;
    [key: string]: any;
  }

  export class ElasticsearchTransport extends Transport {
    constructor(options: ElasticsearchTransportOptions);
  }
}

declare module 'prom-client' {
  export interface DefaultMetricsCollectorConfiguration {
    register?: Registry;
    prefix?: string;
    labels?: Record<string, string>;
    [key: string]: any;
  }

  export function collectDefaultMetrics(config?: DefaultMetricsCollectorConfiguration): void;

  export class Registry {
    setDefaultLabels(labels: Record<string, string>): void;
    metrics(): Promise<string>;
    contentType: string;
  }

  export interface MetricConfiguration<T extends string = string> {
    name: string;
    help: string;
    labelNames?: T[];
    registers?: Registry[];
    buckets?: number[];
  }

  export class Counter<T extends string = string> {
    constructor(config: MetricConfiguration<T>);
    inc(labels?: Partial<Record<T, string | number>>, value?: number): void;
    inc(value?: number): void;
  }

  export class Gauge<T extends string = string> {
    constructor(config: MetricConfiguration<T>);
    set(labels: Partial<Record<T, string | number>>, value: number): void;
    set(value: number): void;
    inc(labels?: Partial<Record<T, string | number>>, value?: number): void;
    inc(value?: number): void;
    dec(labels?: Partial<Record<T, string | number>>, value?: number): void;
    dec(value?: number): void;
  }

  export class Histogram<T extends string = string> {
    constructor(config: MetricConfiguration<T>);
    observe(labels: Partial<Record<T, string | number>>, value: number): void;
    observe(value: number): void;
  }
}
