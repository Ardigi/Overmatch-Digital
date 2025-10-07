import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as tf from '@tensorflow/tfjs-node';
import { EventPattern } from '@nestjs/microservices';

export interface Insight {
  id: string;
  type: 'trend' | 'correlation' | 'outlier' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  data: Record<string, any>;
  visualizations?: Array<{
    type: 'chart' | 'graph' | 'heatmap' | 'table';
    config: Record<string, any>;
  }>;
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  frequency: number;
  confidence: number;
  examples: any[];
  rules?: Array<{
    condition: string;
    action: string;
  }>;
}

export interface Recommendation {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actions: string[];
  expectedImpact: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  relatedInsights?: string[];
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class AIAnalyticsService {
  private readonly logger = new Logger(AIAnalyticsService.name);
  private readonly timeSeriesData = new Map<string, TimeSeriesData[]>();
  private readonly patternCache = new Map<string, Pattern[]>();
  private models: Map<string, tf.LayersModel> = new Map();

  constructor(private configService: ConfigService) {
    this.initializeModels();
  }

  private async initializeModels() {
    try {
      // Initialize TensorFlow.js models
      // In production, these would be loaded from saved models
      this.logger.log('AI Analytics models initialized');
    } catch (error) {
      this.logger.error('Failed to initialize AI models', error);
    }
  }

  async generateInsights(event: any): Promise<Insight[]> {
    const insights: Insight[] = [];

    try {
      // Trend Analysis
      const trendInsight = await this.analyzeTrends(event);
      if (trendInsight) insights.push(trendInsight);

      // Correlation Analysis
      const correlations = await this.findCorrelations(event);
      insights.push(...correlations);

      // Predictive Insights
      const predictions = await this.generatePredictiveInsights(event);
      insights.push(...predictions);

      // Business Impact Analysis
      const impactInsight = await this.analyzeBusinessImpact(event);
      if (impactInsight) insights.push(impactInsight);

    } catch (error) {
      this.logger.error('Failed to generate insights', error);
    }

    return insights;
  }

  private async analyzeTrends(event: any): Promise<Insight | null> {
    try {
      const seriesKey = `${event.source}_${event.eventType}`;
      const series = this.timeSeriesData.get(seriesKey) || [];

      if (series.length < 10) {
        return null; // Not enough data for trend analysis
      }

      // Simple moving average calculation
      const values = series.slice(-30).map(d => d.value);
      const sma = values.reduce((a, b) => a + b, 0) / values.length;
      
      // Calculate trend direction
      const recentAvg = values.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const olderAvg = values.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
      
      const trendDirection = recentAvg > olderAvg ? 'increasing' : 'decreasing';
      const trendStrength = Math.abs(recentAvg - olderAvg) / olderAvg;

      if (trendStrength > 0.1) { // Significant trend
        return {
          id: `trend_${Date.now()}`,
          type: 'trend',
          title: `${trendDirection.charAt(0).toUpperCase() + trendDirection.slice(1)} Trend Detected`,
          description: `${event.eventType} is ${trendDirection} by ${(trendStrength * 100).toFixed(1)}%`,
          confidence: Math.min(0.5 + trendStrength, 0.95),
          impact: trendStrength > 0.3 ? 'high' : trendStrength > 0.15 ? 'medium' : 'low',
          data: {
            trendDirection,
            trendStrength,
            currentValue: recentAvg,
            previousValue: olderAvg,
            movingAverage: sma,
          },
          visualizations: [{
            type: 'chart',
            config: {
              type: 'line',
              data: values,
              trend: trendDirection,
            },
          }],
        };
      }
    } catch (error) {
      this.logger.error('Trend analysis failed', error);
    }

    return null;
  }

  private async findCorrelations(event: any): Promise<Insight[]> {
    const insights: Insight[] = [];

    try {
      // Find correlations between different metrics
      if (event.metrics && typeof event.metrics === 'object') {
        const metrics = Object.entries(event.metrics);
        
        for (let i = 0; i < metrics.length; i++) {
          for (let j = i + 1; j < metrics.length; j++) {
            const [key1, value1] = metrics[i];
            const [key2, value2] = metrics[j];
            
            if (typeof value1 === 'number' && typeof value2 === 'number') {
              // Simple correlation check
              const correlation = this.calculateCorrelation([value1], [value2]);
              
              if (Math.abs(correlation) > 0.7) {
                insights.push({
                  id: `correlation_${Date.now()}_${i}_${j}`,
                  type: 'correlation',
                  title: 'Strong Correlation Detected',
                  description: `${key1} and ${key2} show ${correlation > 0 ? 'positive' : 'negative'} correlation`,
                  confidence: Math.abs(correlation),
                  impact: Math.abs(correlation) > 0.9 ? 'high' : 'medium',
                  data: {
                    metric1: key1,
                    metric2: key2,
                    correlation,
                    relationship: correlation > 0 ? 'positive' : 'negative',
                  },
                });
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Correlation analysis failed', error);
    }

    return insights;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private async generatePredictiveInsights(event: any): Promise<Insight[]> {
    const insights: Insight[] = [];

    try {
      // Generate predictions based on historical patterns
      const seriesKey = `${event.source}_${event.eventType}`;
      const series = this.timeSeriesData.get(seriesKey) || [];

      if (series.length >= 30) {
        // Simple linear regression for prediction
        const values = series.slice(-30).map(d => d.value);
        const prediction = this.predictNextValue(values);
        
        if (prediction) {
          const lastValue = values[values.length - 1];
          const changePercent = ((prediction - lastValue) / lastValue) * 100;
          
          insights.push({
            id: `prediction_${Date.now()}`,
            type: 'prediction',
            title: 'Future Value Prediction',
            description: `Expected ${changePercent > 0 ? 'increase' : 'decrease'} of ${Math.abs(changePercent).toFixed(1)}% in next period`,
            confidence: 0.75,
            impact: Math.abs(changePercent) > 20 ? 'high' : Math.abs(changePercent) > 10 ? 'medium' : 'low',
            data: {
              currentValue: lastValue,
              predictedValue: prediction,
              changePercent,
              horizon: '1 period',
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Predictive analysis failed', error);
    }

    return insights;
  }

  private predictNextValue(values: number[]): number | null {
    if (values.length < 2) return null;

    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return slope * n + intercept;
  }

  private async analyzeBusinessImpact(event: any): Promise<Insight | null> {
    try {
      // Analyze business impact based on event type and data
      if (event.eventType === 'control.failed' || event.eventType === 'compliance.violation') {
        const severity = event.severity || 'medium';
        const affectedControls = event.affectedControls || 1;
        
        return {
          id: `impact_${Date.now()}`,
          type: 'recommendation',
          title: 'Compliance Risk Detected',
          description: `${affectedControls} control(s) affected with ${severity} severity`,
          confidence: 0.85,
          impact: severity === 'critical' ? 'high' : severity === 'high' ? 'high' : 'medium',
          data: {
            eventType: event.eventType,
            severity,
            affectedControls,
            riskScore: this.calculateRiskScore(event),
          },
          visualizations: [{
            type: 'heatmap',
            config: {
              data: { severity, controls: affectedControls },
            },
          }],
        };
      }
    } catch (error) {
      this.logger.error('Business impact analysis failed', error);
    }

    return null;
  }

  private calculateRiskScore(event: any): number {
    let score = 50; // Base score

    // Adjust based on severity
    if (event.severity === 'critical') score += 40;
    else if (event.severity === 'high') score += 30;
    else if (event.severity === 'medium') score += 20;
    else if (event.severity === 'low') score += 10;

    // Adjust based on frequency
    if (event.frequency === 'frequent') score += 20;
    else if (event.frequency === 'occasional') score += 10;

    // Adjust based on impact
    if (event.impact === 'high') score += 20;
    else if (event.impact === 'medium') score += 10;

    return Math.min(100, score);
  }

  async generateRecommendations(event: any): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    try {
      // Generate recommendations based on event type and patterns
      if (event.eventType === 'performance.degradation') {
        recommendations.push({
          id: `rec_${Date.now()}_1`,
          type: 'optimization',
          priority: 'high',
          title: 'Performance Optimization Required',
          description: 'System performance has degraded below acceptable thresholds',
          actions: [
            'Review and optimize database queries',
            'Implement caching strategies',
            'Scale infrastructure resources',
            'Analyze and optimize slow endpoints',
          ],
          expectedImpact: '30-50% performance improvement',
          estimatedEffort: 'medium',
        });
      }

      if (event.eventType === 'security.threat') {
        recommendations.push({
          id: `rec_${Date.now()}_2`,
          type: 'security',
          priority: 'critical',
          title: 'Immediate Security Action Required',
          description: 'Security threat detected that requires immediate attention',
          actions: [
            'Review security logs for suspicious activity',
            'Update security policies and rules',
            'Implement additional monitoring',
            'Conduct security audit',
          ],
          expectedImpact: 'Mitigate security risks',
          estimatedEffort: 'high',
        });
      }

      // Pattern-based recommendations
      const patterns = await this.extractPatterns(event.source || 'unknown', event);
      for (const pattern of patterns) {
        if (pattern.frequency > 5 && pattern.confidence > 0.7) {
          recommendations.push({
            id: `rec_${Date.now()}_pattern_${pattern.id}`,
            type: 'automation',
            priority: 'medium',
            title: `Automate Recurring Pattern: ${pattern.name}`,
            description: pattern.description,
            actions: [
              `Create automation rule for ${pattern.name}`,
              'Implement automated response workflow',
              'Set up monitoring alerts',
            ],
            expectedImpact: `Reduce manual intervention by ${(pattern.frequency * 10)}%`,
            estimatedEffort: 'low',
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to generate recommendations', error);
    }

    return recommendations;
  }

  async extractPatterns(source: string, event: any): Promise<Pattern[]> {
    const cacheKey = `${source}_${event.eventType}`;
    const cached = this.patternCache.get(cacheKey);
    
    if (cached && cached.length > 0) {
      // Update pattern frequency
      for (const pattern of cached) {
        pattern.frequency++;
        pattern.examples.push(event);
        if (pattern.examples.length > 10) {
          pattern.examples = pattern.examples.slice(-10); // Keep last 10 examples
        }
      }
      return cached;
    }

    const patterns: Pattern[] = [];

    try {
      // Extract patterns from event data
      if (event.pattern || event.sequence) {
        patterns.push({
          id: `pattern_${Date.now()}`,
          name: event.pattern || 'Detected Pattern',
          description: `Recurring pattern in ${source}`,
          frequency: 1,
          confidence: 0.8,
          examples: [event],
        });
      }

      // Store in cache
      this.patternCache.set(cacheKey, patterns);
    } catch (error) {
      this.logger.error('Pattern extraction failed', error);
    }

    return patterns;
  }

  async updateTimeSeries(source: string, event: any): Promise<void> {
    try {
      const key = `${source}_${event.eventType}`;
      const series = this.timeSeriesData.get(key) || [];
      
      // Extract numeric value from event
      let value = 0;
      if (typeof event.value === 'number') {
        value = event.value;
      } else if (event.metrics && typeof event.metrics.value === 'number') {
        value = event.metrics.value;
      } else if (event.count !== undefined) {
        value = event.count;
      } else {
        value = 1; // Count occurrence
      }

      series.push({
        timestamp: new Date(event.timestamp || Date.now()),
        value,
        metadata: {
          source,
          eventType: event.eventType,
          eventId: event.id,
        },
      });

      // Keep only last 1000 data points
      if (series.length > 1000) {
        series.splice(0, series.length - 1000);
      }

      this.timeSeriesData.set(key, series);
    } catch (error) {
      this.logger.error('Failed to update time series', error);
    }
  }

  async forecastTimeSeries(
    source: string,
    eventType: string,
    periods: number = 10,
  ): Promise<number[]> {
    const key = `${source}_${eventType}`;
    const series = this.timeSeriesData.get(key) || [];
    
    if (series.length < 10) {
      return []; // Not enough data
    }

    const values = series.slice(-Math.min(100, series.length)).map(d => d.value);
    const forecast: number[] = [];

    try {
      // Simple exponential smoothing for forecasting
      const alpha = 0.3; // Smoothing parameter
      let s = values[0];
      
      for (const value of values) {
        s = alpha * value + (1 - alpha) * s;
      }

      // Generate forecast
      for (let i = 0; i < periods; i++) {
        forecast.push(s);
      }
    } catch (error) {
      this.logger.error('Forecasting failed', error);
    }

    return forecast;
  }
}