import { SetMetadata } from '@nestjs/common';
import { Action, type Resource } from '../services/authorization.service';

export const AUTHORIZATION_KEY = 'authorization';

export interface AuthorizationMetadata {
  action: Action;
  resource: Resource;
  useParams?: string; // Parameter name containing resource ID
  checkOwnership?: boolean;
}

export const Authorize = (
  action: Action,
  resource: Resource,
  options?: Partial<AuthorizationMetadata>
): MethodDecorator => {
  return SetMetadata(AUTHORIZATION_KEY, {
    action,
    resource,
    ...options,
  });
};

// Convenience decorators for common operations
export const AuthorizeCreate = (resource: Resource) => Authorize(Action.CREATE, resource);

export const AuthorizeRead = (resource: Resource, useParams?: string) =>
  Authorize(Action.READ, resource, { useParams });

export const AuthorizeUpdate = (resource: Resource, useParams?: string, checkOwnership = false) =>
  Authorize(Action.UPDATE, resource, { useParams, checkOwnership });

export const AuthorizeDelete = (resource: Resource, useParams?: string) =>
  Authorize(Action.DELETE, resource, { useParams });

export const AuthorizeApprove = (resource: Resource, useParams?: string) =>
  Authorize(Action.APPROVE, resource, { useParams });

export const AuthorizePublish = (resource: Resource, useParams?: string) =>
  Authorize(Action.PUBLISH, resource, { useParams });
