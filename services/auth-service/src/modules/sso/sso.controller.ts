import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  PermissionGuard,
  Permissions,
  Public,
  RolesGuard,
} from '../shared-auth';
import { CreateSsoProviderDto } from './dto/create-sso-provider.dto';
import { UpdateSsoProviderDto } from './dto/update-sso-provider.dto';
import { SsoService } from './sso.service';

@Controller('api/v1/sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  // Provider Management Endpoints
  @Post('providers')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Permissions('sso:create')
  async createProvider(@Body() createSsoProviderDto: CreateSsoProviderDto, @Request() req) {
    return this.ssoService.createProvider(createSsoProviderDto, req.user.organizationId);
  }

  @Get('providers')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Permissions('sso:read')
  async findAllProviders(@Request() req, @Query('global') global?: boolean) {
    const organizationId = global && req.user.roles?.includes('admin') ? undefined : req.user.organizationId;
    return this.ssoService.findAllProviders(organizationId);
  }

  @Get('providers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Permissions('sso:read')
  async findProvider(@Param('id') id: string) {
    return this.ssoService.findProviderById(id);
  }

  @Patch('providers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Permissions('sso:update')
  async updateProvider(@Param('id') id: string, @Body() updateSsoProviderDto: UpdateSsoProviderDto) {
    return this.ssoService.updateProvider(id, updateSsoProviderDto);
  }

  @Delete('providers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Permissions('sso:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProvider(@Param('id') id: string) {
    await this.ssoService.deleteProvider(id);
  }

  // SAML Authentication Endpoints
  @Get('saml/:providerId')
  @Public()
  async samlAuth(@Param('providerId') providerId: string, @Response() res) {
    const authUrl = await this.ssoService.generateSamlAuthUrl(providerId);
    return res.redirect(authUrl);
  }

  @Post('saml/:providerId/callback')
  @Public()
  async samlCallback(
    @Param('providerId') providerId: string,
    @Body('SAMLResponse') samlResponse: string,
    @Body('RelayState') relayState: string,
    @Response() res,
  ) {
    try {
      const result = await this.ssoService.handleSamlCallback(providerId, samlResponse, relayState);
      
      // Redirect to frontend with tokens
      const redirectUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
      redirectUrl.pathname = '/auth/sso/callback';
      redirectUrl.searchParams.append('access_token', result.tokens.accessToken);
      redirectUrl.searchParams.append('refresh_token', result.tokens.refreshToken);
      if (relayState) {
        redirectUrl.searchParams.append('relay_state', relayState);
      }

      return res.redirect(redirectUrl.toString());
    } catch (error) {
      // Redirect to error page
      const errorUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
      errorUrl.pathname = '/auth/sso/error';
      errorUrl.searchParams.append('error', error.message);
      
      return res.redirect(errorUrl.toString());
    }
  }

  @Get('saml/:providerId/metadata')
  @Public()
  async samlMetadata(@Param('providerId') providerId: string, @Response() res) {
    const metadata = await this.ssoService.generateSamlMetadata(providerId);
    res.set('Content-Type', 'application/xml');
    return res.send(metadata);
  }

  @Post('saml/:providerId/logout')
  @UseGuards(JwtAuthGuard)
  async samlLogout(
    @Param('providerId') providerId: string,
    @Request() req,
    @Response() res,
  ) {
    const session = await this.ssoService.findActiveSession(req.user.id, providerId);
    if (session) {
      const logoutUrl = await this.ssoService.handleSamlLogout(
        providerId,
        session.nameId,
        session.sessionIndex,
      );
      return res.redirect(logoutUrl);
    }
    return res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  }

  // Session Management
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getUserSessions(@Request() req) {
    return this.ssoService.findActiveSession(req.user.id, null);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async invalidateSession(@Param('sessionId') sessionId: string) {
    await this.ssoService.invalidateSession(sessionId);
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async invalidateAllSessions(@Request() req) {
    await this.ssoService.invalidateAllUserSessions(req.user.id);
  }
}