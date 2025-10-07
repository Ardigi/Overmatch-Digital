import { notFound } from 'next/navigation';
import ProjectHeader from '@/components/projects/ProjectHeader';
import ProjectPhases from '@/components/projects/ProjectPhases';
import ProjectTasks from '@/components/projects/ProjectTasks';
import ProjectTeam from '@/components/projects/ProjectTeam';
import ProjectTimeline from '@/components/projects/ProjectTimeline';

// This would come from database
async function getProject(id: string) {
  // Simulate database fetch
  if (id === '1') {
    return {
      id: '1',
      name: 'SOC 2 Type II - Acme Corp',
      client: 'Acme Corporation',
      type: 'SOC2_TYPE2',
      status: 'IN_PROGRESS',
      framework: ['SOC2_SECURITY', 'SOC2_AVAILABILITY'],
      startDate: new Date('2024-01-15'),
      targetEndDate: new Date('2024-07-15'),
      auditPeriodStart: new Date('2023-07-01'),
      auditPeriodEnd: new Date('2024-06-30'),
      currentPhase: 'IMPLEMENTATION',
      progress: 65,
      description:
        'Annual SOC 2 Type II audit covering Security and Availability trust service criteria.',
    };
  }
  return null;
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <ProjectHeader project={project} />

      {/* 3-Phase Audit Process */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Audit Workflow Progress</h2>
        <ProjectPhases currentPhase={project.currentPhase} projectId={project.id} />
      </div>

      {/* Project Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Project Timeline</h2>
          <ProjectTimeline project={project} />
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Project Team</h2>
          <ProjectTeam projectId={project.id} />
        </div>
      </div>

      {/* Active Tasks */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Active Tasks</h2>
        <ProjectTasks projectId={project.id} />
      </div>
    </div>
  );
}
