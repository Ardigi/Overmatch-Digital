import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { KongUser, KongUserType, Roles } from '../../shared/decorators';
import { KongAuthGuard, KongRolesGuard } from '../../shared/guards';

@ApiTags('test-auth')
@ApiBearerAuth()
@Controller('api/v1/test-auth')
export class TestAuthController {
  @Get('public')
  @ApiOperation({ summary: 'Public endpoint - no auth required' })
  public() {
    return { message: 'This is a public endpoint' };
  }

  @Get('authenticated')
  @UseGuards(KongAuthGuard)
  @ApiOperation({ summary: 'Authenticated endpoint - requires Kong auth' })
  authenticated(@KongUser() user: KongUserType) {
    return {
      message: 'You are authenticated via Kong!',
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        roles: user.roles,
      },
    };
  }

  @Get('admin-only')
  @UseGuards(KongAuthGuard, KongRolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Admin only endpoint' })
  adminOnly(@KongUser() user: KongUserType) {
    return {
      message: 'Hello admin! This endpoint requires admin role',
      user: user.email,
    };
  }

  @Get('compliance-manager')
  @UseGuards(KongAuthGuard, KongRolesGuard)
  @Roles('compliance_manager', 'admin')
  @ApiOperation({ summary: 'Compliance manager endpoint' })
  complianceManager(@KongUser() user: KongUserType) {
    return {
      message: 'This endpoint requires compliance_manager or admin role',
      user: user.email,
      roles: user.roles,
    };
  }
}