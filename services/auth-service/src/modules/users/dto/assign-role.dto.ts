import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
