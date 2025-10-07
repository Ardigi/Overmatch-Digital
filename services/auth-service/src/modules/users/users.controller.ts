import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
// Import specific permission decorators that are local to users
import {
  CanDeleteUsers,
  CanReadUsers,
  CanWriteUsers,
} from '../auth/decorators/permissions.decorator';
import {
  CanAccessOwnResource,
  JwtAuthGuard,
  PermissionGuard,
  RequirePermissions,
} from '../shared-auth';
import type { AssignRoleDto } from './dto/assign-role.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { InviteUserDto } from './dto/invite-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CanReadUsers()
  async findAll(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    // For now, return all users with basic filtering
    const users = await this.usersService.findAll();
    
    // Apply basic filtering
    let filtered = users;
    if (search) {
      filtered = filtered.filter(u => 
        u.email.includes(search) || 
        u.firstName?.includes(search) || 
        u.lastName?.includes(search)
      );
    }
    if (role) {
      filtered = filtered.filter(u => u.roles?.includes(role));
    }
    if (status) {
      filtered = filtered.filter(u => u.status === status);
    }
    
    // Apply pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginated = filtered.slice(startIndex, endIndex);
    
    return {
      data: paginated,
      meta: {
        total: filtered.length,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(filtered.length / Number(limit)),
      },
    };
  }

  @Get('me')
  async getProfile(@Request() req) {
    return this.usersService.findOneWithDetails(req.user.id);
  }

  @Put('me')
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    // Users can only update certain fields of their own profile
    const allowedFields = ['firstName', 'lastName', 'phone', 'profilePicture', 'preferences'];
    const filteredDto: any = {};
    
    for (const field of allowedFields) {
      if (updateUserDto[field] !== undefined) {
        filteredDto[field] = updateUserDto[field];
      }
    }

    return this.usersService.update(req.user.id, filteredDto, req.user);
  }

  @Get(':id')
  @CanAccessOwnResource('id')
  @CanReadUsers()
  async findOne(@Param('id') id: string, @Request() req) {
    const user = await this.usersService.findOneWithDetails(id);
    
    // Check if user has permission to view this user
    if (!this.usersService.canAccessUser(req.user, user)) {
      throw new ForbiddenException('You do not have permission to view this user');
    }

    return user;
  }

  @Post()
  @CanWriteUsers()
  async create(@Body() createUserDto: CreateUserDto, @Request() req) {
    // Set organization based on user's context
    if (!createUserDto.organizationId) {
      createUserDto.organizationId = req.user.organizationId;
    }

    // Validate organization access
    if (!await this.usersService.canAccessOrganization(req.user, createUserDto.organizationId)) {
      throw new ForbiddenException('You do not have permission to create users in this organization');
    }

    return this.usersService.create(createUserDto, req.user);
  }

  @Post('invite')
  @CanWriteUsers()
  async inviteUser(@Body() inviteUserDto: InviteUserDto, @Request() req) {
    if (!inviteUserDto.organizationId) {
      inviteUserDto.organizationId = req.user.organizationId;
    }

    if (!await this.usersService.canAccessOrganization(req.user, inviteUserDto.organizationId)) {
      throw new ForbiddenException('You do not have permission to invite users to this organization');
    }

    return this.usersService.inviteUser(inviteUserDto, req.user);
  }

  @Put(':id')
  @CanWriteUsers()
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    const user = await this.usersService.findOne(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!this.usersService.canAccessUser(req.user, user)) {
      throw new ForbiddenException('You do not have permission to update this user');
    }

    return this.usersService.update(id, updateUserDto, req.user);
  }

  @Delete(':id')
  @CanDeleteUsers()
  async remove(@Param('id') id: string, @Request() req) {
    const user = await this.usersService.findOne(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!this.usersService.canAccessUser(req.user, user)) {
      throw new ForbiddenException('You do not have permission to delete this user');
    }

    // Prevent self-deletion
    if (user.id === req.user.id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    return this.usersService.remove(id, req.user);
  }

  @Post(':id/suspend')
  @CanWriteUsers()
  async suspend(@Param('id') id: string, @Request() req) {
    const user = await this.usersService.findOne(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!this.usersService.canAccessUser(req.user, user)) {
      throw new ForbiddenException('You do not have permission to suspend this user');
    }

    if (user.id === req.user.id) {
      throw new BadRequestException('You cannot suspend your own account');
    }

    return this.usersService.suspend(id, req.user);
  }

  @Post(':id/activate')
  @CanWriteUsers()
  async activate(@Param('id') id: string, @Request() req) {
    const user = await this.usersService.findOne(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!this.usersService.canAccessUser(req.user, user)) {
      throw new ForbiddenException('You do not have permission to activate this user');
    }

    return this.usersService.activate(id, req.user);
  }

  @Post(':id/roles')
  @RequirePermissions('users:write', 'roles:assign')
  async assignRole(
    @Param('id') id: string,
    @Body() assignRoleDto: AssignRoleDto,
    @Request() req,
  ) {
    const user = await this.usersService.findOne(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!this.usersService.canAccessUser(req.user, user)) {
      throw new ForbiddenException('You do not have permission to assign roles to this user');
    }

    return this.usersService.assignRole(id, assignRoleDto.roleId, req.user);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermissions('users:write', 'roles:assign')
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Request() req,
  ) {
    const user = await this.usersService.findOne(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!this.usersService.canAccessUser(req.user, user)) {
      throw new ForbiddenException('You do not have permission to remove roles from this user');
    }

    return this.usersService.removeRole(id, roleId, req.user);
  }

  @Post(':id/unlock')
  @CanWriteUsers()
  async unlock(@Param('id') id: string, @Request() req) {
    const user = await this.usersService.findOne(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!this.usersService.canAccessUser(req.user, user)) {
      throw new ForbiddenException('You do not have permission to unlock this user');
    }

    return this.usersService.unlock(id, req.user);
  }
}