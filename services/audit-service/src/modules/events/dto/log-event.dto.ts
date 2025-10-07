import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export enum EventType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  ACCESS = 'access',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXPORT = 'export',
  IMPORT = 'import',
  APPROVE = 'approve',
  REJECT = 'reject',
  SYSTEM = 'system',
}

export class LogEventDto {
  @ApiProperty({ description: 'User ID who performed the action' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ description: 'Organization ID where the event occurred' })
  @IsString()
  organizationId: string;

  @ApiProperty({
    description: 'Action performed',
    example: 'user.login',
  })
  @IsString()
  action: string;

  @ApiPropertyOptional({
    enum: EventType,
    description: 'Type of event',
  })
  @IsEnum(EventType)
  @IsOptional()
  type?: EventType;

  @ApiProperty({
    description: 'Resource type affected',
    example: 'user',
  })
  @IsString()
  resource: string;

  @ApiPropertyOptional({
    description: 'ID of the resource affected',
  })
  @IsString()
  @IsOptional()
  resourceId?: string;

  @ApiPropertyOptional({
    description: 'Additional event details',
  })
  @IsObject()
  @IsOptional()
  details?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'IP address of the request',
  })
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User agent string',
  })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiPropertyOptional({
    description: 'Source service that generated the event',
  })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when the event occurred',
  })
  @IsDateString()
  @IsOptional()
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class LogEventResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({
    description: 'Response data',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      timestamp: '2024-01-01T00:00:00.000Z',
    },
  })
  data: {
    id: string;
    timestamp: Date;
  };
}
