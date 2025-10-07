import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../../shared/auth-common/decorators/roles.decorator';
import { KongUser } from '../../shared/decorators/kong-user.decorator';
import { KongAuthGuard } from '../../shared/guards/kong-auth.guard';
import { KongRolesGuard } from '../../shared/guards/kong-roles.guard';

@Controller('test')
export class TestController {
  @Get('auth')
  @UseGuards(KongAuthGuard)
  testAuth(@KongUser() user: KongUser) {
    return {
      message: 'Kong auth working!',
      user: user,
    };
  }

  @Get('roles')
  @UseGuards(KongAuthGuard, KongRolesGuard)
  @Roles('admin')
  testRoles(@KongUser() user: KongUser) {
    return {
      message: 'Kong roles working!',
      user: user,
      requiredRole: 'admin',
    };
  }
}