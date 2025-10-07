import { Injectable } from '@nestjs/common';

@Injectable()
export class MockKafkaProducerService {
  private publishedEvents: Array<{ topic: string; event: any }> = [];

  async publish(topic: string, event: any): Promise<void> {
    // Store the event for testing purposes
    this.publishedEvents.push({ topic, event });

    // Log for debugging
    console.log(`[MockKafkaProducer] Publishing to ${topic}:`, event);

    // Simulate async behavior
    return Promise.resolve();
  }

  // Mock specific publish methods used by ClientsService
  async publishClientCreated(clientId: string, clientData: any, userId: string): Promise<void> {
    return this.publish('client.client.created', { clientId, clientData, userId });
  }

  async publishClientUpdated(clientId: string, changes: any, userId: string): Promise<void> {
    return this.publish('client.client.updated', { clientId, changes, userId });
  }

  async publishClientArchived(clientId: string, userId: string): Promise<void> {
    return this.publish('client.client.archived', { clientId, userId });
  }

  async publishClientRestored(clientId: string, userId: string): Promise<void> {
    return this.publish('client.client.restored', { clientId, userId });
  }

  async publishClientOnboardingStarted(clientId: string, data: any, userId: string): Promise<void> {
    return this.publish('client.client.onboarding_started', { clientId, data, userId });
  }

  async publishClientOnboardingCompleted(
    clientId: string,
    data: any,
    userId: string
  ): Promise<void> {
    return this.publish('client.client.onboarding_completed', { clientId, data, userId });
  }

  // Test helper methods
  getPublishedEvents() {
    return this.publishedEvents;
  }

  clearPublishedEvents() {
    this.publishedEvents = [];
  }

  getEventsForTopic(topic: string) {
    return this.publishedEvents.filter((e) => e.topic === topic);
  }
}
