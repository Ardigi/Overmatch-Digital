import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../shared-auth';
import type { EnableMfaDto } from './dto/enable-mfa.dto';
import type { VerifyMfaDto } from './dto/verify-mfa.dto';
import { MfaService } from './mfa.service';

@Controller('api/v1/mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(private mfaService: MfaService) {}

  /**
   * Generate MFA secret and QR code
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateSecret(@Request() req) {
    return this.mfaService.generateSecret(req.user.id);
  }

  /**
   * Enable MFA for user
   */
  @Post('enable')
  @HttpCode(HttpStatus.OK)
  async enableMfa(@Request() req, @Body() enableMfaDto: EnableMfaDto) {
    const { token } = enableMfaDto;
    const result = await this.mfaService.enableMfa(req.user.id, token);
    return { 
      message: 'MFA enabled successfully',
      backupCodes: result.backupCodes 
    };
  }

  /**
   * Disable MFA for user
   */
  @Delete('disable')
  @HttpCode(HttpStatus.OK)
  async disableMfa(@Request() req, @Body() verifyMfaDto: VerifyMfaDto) {
    // Verify MFA before disabling
    const verifyResult = await this.mfaService.verifyToken(req.user.id, verifyMfaDto.token);
    if (!verifyResult.valid) {
      throw new UnauthorizedException('Invalid MFA token');
    }
    await this.mfaService.disableMfa(req.user.id);
    return { message: 'MFA disabled successfully' };
  }

  /**
   * Verify MFA token
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@Request() req, @Body() verifyMfaDto: VerifyMfaDto) {
    const result = await this.mfaService.verifyToken(
      req.user.id,
      verifyMfaDto.token,
    );
    return {
      verified: result.valid,
      isBackupCode: verifyMfaDto.token.includes('-'),
    };
  }

  /**
   * Regenerate backup codes
   */
  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerateBackupCodes(
    @Request() req,
    @Body() verifyMfaDto: VerifyMfaDto,
  ) {
    // Verify MFA before regenerating codes
    const verifyResult = await this.mfaService.verifyToken(req.user.id, verifyMfaDto.token);
    if (!verifyResult.valid) {
      throw new UnauthorizedException('Invalid MFA token');
    }
    const result = await this.mfaService.generateBackupCodesForUser(
      req.user.id,
    );
    return { backupCodes: result.codes };
  }

  /**
   * Get MFA status for user
   */
  @Get('status')
  async getMfaStatus(@Request() req) {
    return this.mfaService.getUserMFAStatus(req.user.id);
  }
}