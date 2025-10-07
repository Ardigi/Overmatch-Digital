import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Sanitize } from '../../../shared/decorators/sanitize.decorator';

export enum PortalUserRole {
  CLIENT_ADMIN = 'client_admin',
  CLIENT_USER = 'client_user',
  CLIENT_VIEWER = 'client_viewer',
}

export enum PortalUserStatus {
  PENDING_INVITATION = 'pending_invitation',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export class InvitePortalUserDto {
  @ApiProperty({ description: 'Email address of the user to invite' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'First name of the user' })
  @IsString()
  @Sanitize()
  firstName: string;

  @ApiProperty({ description: 'Last name of the user' })
  @IsString()
  @Sanitize()
  lastName: string;

  @ApiProperty({
    description: 'Role in the client portal',
    enum: PortalUserRole,
    default: PortalUserRole.CLIENT_USER,
  })
  @IsEnum(PortalUserRole)
  @IsOptional()
  role?: PortalUserRole = PortalUserRole.CLIENT_USER;

  @ApiProperty({ description: 'Title or position in the organization', required: false })
  @IsString()
  @IsOptional()
  @Sanitize()
  title?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsString()
  @IsOptional()
  @Sanitize()
  phone?: string;

  @ApiProperty({ description: 'Department', required: false })
  @IsString()
  @IsOptional()
  @Sanitize()
  department?: string;

  @ApiProperty({ description: 'Send invitation email immediately', default: true })
  @IsBoolean()
  @IsOptional()
  sendInvitation?: boolean = true;
}

export class UpdatePortalUserDto {
  @ApiProperty({ description: 'First name', required: false })
  @IsString()
  @IsOptional()
  @Sanitize()
  firstName?: string;

  @ApiProperty({ description: 'Last name', required: false })
  @IsString()
  @IsOptional()
  @Sanitize()
  lastName?: string;

  @ApiProperty({
    description: 'Role in the client portal',
    enum: PortalUserRole,
    required: false,
  })
  @IsEnum(PortalUserRole)
  @IsOptional()
  role?: PortalUserRole;

  @ApiProperty({ description: 'Title or position', required: false })
  @IsString()
  @IsOptional()
  @Sanitize()
  title?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsString()
  @IsOptional()
  @Sanitize()
  phone?: string;

  @ApiProperty({ description: 'Department', required: false })
  @IsString()
  @IsOptional()
  @Sanitize()
  department?: string;

  @ApiProperty({
    description: 'User status',
    enum: PortalUserStatus,
    required: false,
  })
  @IsEnum(PortalUserStatus)
  @IsOptional()
  status?: PortalUserStatus;
}

export class PortalAccessSettingsDto {
  @ApiProperty({ description: 'Enable client portal access', default: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Allow users to view audit reports', default: true })
  @IsBoolean()
  @IsOptional()
  viewAuditReports?: boolean;

  @ApiProperty({ description: 'Allow users to upload evidence', default: true })
  @IsBoolean()
  @IsOptional()
  uploadEvidence?: boolean;

  @ApiProperty({ description: 'Allow users to view compliance status', default: true })
  @IsBoolean()
  @IsOptional()
  viewComplianceStatus?: boolean;

  @ApiProperty({ description: 'Allow users to manage other users', default: false })
  @IsBoolean()
  @IsOptional()
  manageUsers?: boolean;

  @ApiProperty({ description: 'Allow users to view contracts', default: false })
  @IsBoolean()
  @IsOptional()
  viewContracts?: boolean;

  @ApiProperty({ description: 'Allow users to request support', default: true })
  @IsBoolean()
  @IsOptional()
  requestSupport?: boolean;

  @ApiProperty({ description: 'IP whitelist for portal access', required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ipWhitelist?: string[];

  @ApiProperty({ description: 'Require MFA for portal access', default: false })
  @IsBoolean()
  @IsOptional()
  requireMfa?: boolean;

  @ApiProperty({ description: 'Custom branding settings', required: false })
  @IsOptional()
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    customCss?: string;
  };
}

export class PortalActivityLogDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Activity type' })
  @IsString()
  @Sanitize()
  activityType: string;

  @ApiProperty({ description: 'Activity details' })
  @IsOptional()
  details?: any;

  @ApiProperty({ description: 'IP address' })
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiProperty({ description: 'User agent' })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiProperty({ description: 'Timestamp' })
  @IsDateString()
  timestamp: Date;
}

export class ClientPortalDashboardDto {
  @ApiProperty({ description: 'Client information' })
  client: {
    id: string;
    name: string;
    logo?: string;
    complianceStatus: string;
    complianceScore: number;
  };

  @ApiProperty({ description: 'Upcoming audits' })
  upcomingAudits: Array<{
    id: string;
    framework: string;
    scheduledDate: Date;
    status: string;
  }>;

  @ApiProperty({ description: 'Active contracts' })
  activeContracts: Array<{
    id: string;
    contractNumber: string;
    type: string;
    endDate: Date;
  }>;

  @ApiProperty({ description: 'Recent activity' })
  recentActivity: PortalActivityLogDto[];

  @ApiProperty({ description: 'Compliance metrics' })
  complianceMetrics: {
    controlsImplemented: number;
    controlsTotal: number;
    openFindings: number;
    overdueItems: number;
  };

  @ApiProperty({ description: 'Documents requiring attention' })
  pendingDocuments: Array<{
    id: string;
    name: string;
    type: string;
    dueDate?: Date;
  }>;
}

export class BulkInvitePortalUsersDto {
  @ApiProperty({
    description: 'List of users to invite',
    type: [InvitePortalUserDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvitePortalUserDto)
  users: InvitePortalUserDto[];

  @ApiProperty({ description: 'Send all invitations immediately', default: true })
  @IsBoolean()
  @IsOptional()
  sendInvitations?: boolean = true;

  @ApiProperty({ description: 'Custom invitation message', required: false })
  @IsString()
  @IsOptional()
  @Sanitize()
  customMessage?: string;
}

export class ResendInvitationDto {
  @ApiProperty({ description: 'User ID to resend invitation to' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Custom message for the invitation', required: false })
  @IsString()
  @IsOptional()
  @Sanitize()
  customMessage?: string;
}
