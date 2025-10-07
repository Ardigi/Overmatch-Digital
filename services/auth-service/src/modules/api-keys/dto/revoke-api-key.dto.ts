import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeApiKeyDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
