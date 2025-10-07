import IntegrationsHeader from '@/components/integrations/IntegrationsHeader';
import IntegrationsList from '@/components/integrations/IntegrationsList';

export default function IntegrationsPage() {
  return (
    <div className="space-y-8">
      <IntegrationsHeader />

      {/* Integrations List */}
      <IntegrationsList />
    </div>
  );
}
