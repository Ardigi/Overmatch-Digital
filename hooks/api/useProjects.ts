import {
  type CreateProjectData,
  type Project,
  projectsApi,
  type UpdateProjectData,
} from '@/lib/api/projects';
import { useApi, useMutation, usePaginatedApi } from '../useApi';

// Project hooks
export function useProjects(filters?: any, options?: any) {
  return usePaginatedApi(
    (params) => projectsApi.getProjects({ ...filters, ...params }),
    filters,
    options
  );
}

export function useProject(id: string, options?: any) {
  return useApi<Project>(() => projectsApi.getProject(id), [id], { immediate: !!id, ...options });
}

export function useCreateProject(options?: any) {
  return useMutation((data: CreateProjectData) => projectsApi.createProject(data), options);
}

export function useUpdateProject(options?: any) {
  return useMutation(
    ({ id, data }: { id: string; data: UpdateProjectData }) => projectsApi.updateProject(id, data),
    options
  );
}

export function useDeleteProject(options?: any) {
  return useMutation((id: string) => projectsApi.deleteProject(id), options);
}

// Project Tasks
export function useProjectTasks(projectId: string, options?: any) {
  return useApi(() => projectsApi.getProjectTasks(projectId), [projectId], {
    immediate: !!projectId,
    ...options,
  });
}

export function useCreateProjectTask(options?: any) {
  return useMutation(
    ({ projectId, data }: { projectId: string; data: any }) =>
      projectsApi.createProjectTask(projectId, data),
    options
  );
}

export function useUpdateProjectTask(options?: any) {
  return useMutation(
    ({ projectId, taskId, data }: { projectId: string; taskId: string; data: any }) =>
      projectsApi.updateProjectTask(projectId, taskId, data),
    options
  );
}

// Project Team
export function useProjectTeam(projectId: string, options?: any) {
  return useApi(() => projectsApi.getProjectTeam(projectId), [projectId], {
    immediate: !!projectId,
    ...options,
  });
}

export function useAddTeamMember(options?: any) {
  return useMutation(
    ({ projectId, userId, role }: { projectId: string; userId: string; role: string }) =>
      projectsApi.addTeamMember(projectId, userId, role),
    options
  );
}

export function useRemoveTeamMember(options?: any) {
  return useMutation(
    ({ projectId, userId }: { projectId: string; userId: string }) =>
      projectsApi.removeTeamMember(projectId, userId),
    options
  );
}

// Project Progress
export function useProjectProgress(projectId: string, options?: any) {
  return useApi(() => projectsApi.getProjectProgress(projectId), [projectId], {
    immediate: !!projectId,
    ...options,
  });
}

// Project Compliance
export function useProjectCompliance(projectId: string, options?: any) {
  return useApi(() => projectsApi.getProjectCompliance(projectId), [projectId], {
    immediate: !!projectId,
    ...options,
  });
}
