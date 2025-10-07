import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserStatus, UserType } from '../entities/user.entity';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @IsEnum(UserType)
  @IsOptional()
  userType?: UserType;

  @IsString()
  @IsOptional()
  profilePicture?: string;

  @IsObject()
  @IsOptional()
  preferences?: {
    theme?: 'light' | 'dark';
    notifications?: {
      email?: boolean;
      inApp?: boolean;
      sms?: boolean;
    };
    timezone?: string;
    language?: string;
  };
}
