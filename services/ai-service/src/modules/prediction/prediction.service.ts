import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as tf from '@tensorflow/tfjs-node';

export interface ModelConfig {
  name: string;
  version: string;
  type: 'classification' | 'regression' | 'clustering' | 'anomaly';
  inputShape: number[];
  outputShape: number[];
  metrics: string[];
}

export interface PredictionParameters {
  threshold?: number;
  confidence?: number;
  timeHorizon?: number;
  includeExplanation?: boolean;
}

export interface FeatureImportance {
  name: string;
  importance: number;
  value: any;
}

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  private readonly models = new Map<string, tf.LayersModel>();
  private readonly modelConfigs = new Map<string, ModelConfig>();

  constructor(private configService: ConfigService) {
    this.initializeModels();
  }

  private async initializeModels() {
    // In production, load pre-trained models
    // For now, create simple models for demonstration
    await this.createRiskModel();
    await this.createComplianceModel();
    await this.createFraudModel();
    await this.createPerformanceModel();
    await this.createCostModel();
  }

  private async createRiskModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 20, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 10, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }),
      ],
    });

    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    this.models.set('risk', model);
    this.modelConfigs.set('risk', {
      name: 'Risk Assessment Model',
      version: '1.0.0',
      type: 'classification',
      inputShape: [10],
      outputShape: [1],
      metrics: ['accuracy', 'precision', 'recall'],
    });
  }

  private async createComplianceModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [15], units: 30, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 20, activation: 'relu' }),
        tf.layers.dense({ units: 5, activation: 'softmax' }),
      ],
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    this.models.set('compliance', model);
    this.modelConfigs.set('compliance', {
      name: 'Compliance Classification Model',
      version: '1.0.0',
      type: 'classification',
      inputShape: [15],
      outputShape: [5],
      metrics: ['accuracy', 'f1Score'],
    });
  }

  private async createFraudModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [20], units: 40, activation: 'relu' }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 20, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall'],
    });

    this.models.set('fraud', model);
    this.modelConfigs.set('fraud', {
      name: 'Fraud Detection Model',
      version: '1.0.0',
      type: 'classification',
      inputShape: [20],
      outputShape: [1],
      metrics: ['accuracy', 'precision', 'recall', 'auc'],
    });
  }

  private async createPerformanceModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [8], units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'linear' }),
      ],
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });

    this.models.set('performance', model);
    this.modelConfigs.set('performance', {
      name: 'Performance Prediction Model',
      version: '1.0.0',
      type: 'regression',
      inputShape: [8],
      outputShape: [1],
      metrics: ['mse', 'mae', 'r2'],
    });
  }

  private async createCostModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [12], units: 24, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 12, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'linear' }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanAbsoluteError',
      metrics: ['mse'],
    });

    this.models.set('cost', model);
    this.modelConfigs.set('cost', {
      name: 'Cost Prediction Model',
      version: '1.0.0',
      type: 'regression',
      inputShape: [12],
      outputShape: [1],
      metrics: ['mae', 'mape'],
    });
  }

  async loadModel(modelType: string): Promise<tf.LayersModel> {
    const model = this.models.get(modelType);
    
    if (!model) {
      // Try to load from file if not in memory
      const modelPath = this.configService.get(`AI_MODEL_PATH_${modelType.toUpperCase()}`);
      if (modelPath) {
        try {
          const loadedModel = await tf.loadLayersModel(`file://${modelPath}`);
          this.models.set(modelType, loadedModel);
          return loadedModel;
        } catch (error) {
          this.logger.error(`Failed to load model from ${modelPath}`, error);
        }
      }
      throw new Error(`Model not found: ${modelType}`);
    }
    
    return model;
  }

  async predict(
    model: tf.LayersModel,
    inputData: Record<string, any>,
    parameters?: PredictionParameters,
  ): Promise<any> {
    try {
      // Prepare input tensor
      const inputTensor = this.prepareInputTensor(inputData);
      
      // Make prediction
      const prediction = model.predict(inputTensor) as tf.Tensor;
      const result = await prediction.array();
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
      
      // Process results based on model type
      const confidence = this.calculateConfidence(result);
      const explanation = parameters?.includeExplanation 
        ? this.generateExplanation(inputData, result) 
        : undefined;
      
      return {
        prediction: result,
        confidence,
        explanation,
      };
    } catch (error) {
      this.logger.error('Prediction failed', error);
      throw error;
    }
  }

  private prepareInputTensor(inputData: Record<string, any>): tf.Tensor {
    // Convert input data to tensor format
    const values = Object.values(inputData)
      .filter(v => typeof v === 'number')
      .map(v => Number(v));
    
    if (values.length === 0) {
      throw new Error('No numeric input data provided');
    }
    
    return tf.tensor2d([values]);
  }

  private calculateConfidence(prediction: any): number {
    // Calculate confidence based on prediction type
    if (Array.isArray(prediction) && prediction.length > 0) {
      const values = Array.isArray(prediction[0]) ? prediction[0] : prediction;
      
      // For binary classification
      if (values.length === 1) {
        const prob = values[0];
        return Math.max(prob, 1 - prob);
      }
      
      // For multi-class classification
      if (values.length > 1) {
        return Math.max(...values);
      }
    }
    
    return 0.5; // Default confidence
  }

  private generateExplanation(inputData: Record<string, any>, prediction: any): string[] {
    const explanations: string[] = [];
    
    // Generate basic explanations
    explanations.push(`Prediction based on ${Object.keys(inputData).length} input features`);
    
    // Identify key factors
    const importantFeatures = Object.entries(inputData)
      .filter(([_, value]) => typeof value === 'number' && Math.abs(Number(value)) > 0.5)
      .map(([key, value]) => `${key}: ${value}`);
    
    if (importantFeatures.length > 0) {
      explanations.push(`Key factors: ${importantFeatures.join(', ')}`);
    }
    
    // Add confidence explanation
    const confidence = this.calculateConfidence(prediction);
    if (confidence > 0.9) {
      explanations.push('High confidence prediction based on strong patterns');
    } else if (confidence > 0.7) {
      explanations.push('Moderate confidence prediction');
    } else {
      explanations.push('Low confidence - additional data may improve accuracy');
    }
    
    return explanations;
  }

  async calculateFeatureImportance(
    model: tf.LayersModel,
    inputData: Record<string, any>,
    features: string[],
  ): Promise<FeatureImportance[]> {
    const importances: FeatureImportance[] = [];
    
    try {
      // Base prediction
      const basePrediction = await this.predict(model, inputData);
      const baseValue = Array.isArray(basePrediction.prediction[0]) 
        ? basePrediction.prediction[0][0] 
        : basePrediction.prediction[0];
      
      // Calculate importance for each feature
      for (const feature of features) {
        if (!(feature in inputData)) continue;
        
        // Perturb feature
        const perturbedData = { ...inputData };
        const originalValue = perturbedData[feature];
        
        if (typeof originalValue === 'number') {
          // Try with zero value
          perturbedData[feature] = 0;
          const perturbedPrediction = await this.predict(model, perturbedData);
          const perturbedValue = Array.isArray(perturbedPrediction.prediction[0]) 
            ? perturbedPrediction.prediction[0][0] 
            : perturbedPrediction.prediction[0];
          
          const importance = Math.abs(baseValue - perturbedValue);
          
          importances.push({
            name: feature,
            importance,
            value: originalValue,
          });
        }
      }
      
      // Normalize importances
      const totalImportance = importances.reduce((sum, f) => sum + f.importance, 0);
      if (totalImportance > 0) {
        for (const feature of importances) {
          feature.importance = feature.importance / totalImportance;
        }
      }
      
      // Sort by importance
      importances.sort((a, b) => b.importance - a.importance);
      
    } catch (error) {
      this.logger.error('Feature importance calculation failed', error);
    }
    
    return importances;
  }

  async saveModel(modelType: string, path: string): Promise<void> {
    const model = this.models.get(modelType);
    if (!model) {
      throw new Error(`Model not found: ${modelType}`);
    }
    
    try {
      await model.save(`file://${path}`);
      this.logger.log(`Model saved: ${modelType} to ${path}`);
    } catch (error) {
      this.logger.error(`Failed to save model: ${modelType}`, error);
      throw error;
    }
  }

  getModelConfig(modelType: string): ModelConfig | undefined {
    return this.modelConfigs.get(modelType);
  }

  getAvailableModels(): string[] {
    return Array.from(this.models.keys());
  }
}