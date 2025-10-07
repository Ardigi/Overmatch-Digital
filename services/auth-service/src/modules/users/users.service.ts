import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { In, IsNull, Like, Not, Repository } from 'typeorm';
import { AuditAction, AuditLog } from '../audit/entities/audit-log.entity';
import { PasswordPolicyService } from '../shared-auth';
import type { CreateUserDto } from './dto/create-user.dto';
import type { InviteUserDto } from './dto/invite-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import {
  Organization,
  OrganizationStatus,
  Permission,
  Role,
  RolePermission,
  User,
  UserRole,
  UserStatus,
  UserType,
} from './entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private eventEmitter: EventEmitter2,
    private passwordPolicyService: PasswordPolicyService,
  ) {}

  // Simple findAll for initial setup check
  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  // Create the first admin user during setup
  async createFirstUser(
    email: string,
    password: string,
    organizationName: string,
    firstName?: string,
    lastName?: string,
  ): Promise<User> {
    // Check if any users exist
    const userCount = await this.userRepository.count();
    if (userCount > 0) {
      throw new ConflictException('Users already exist');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create organization
    const organization = this.organizationRepository.create({
      name: organizationName,
      status: OrganizationStatus.ACTIVE,
    });
    await this.organizationRepository.save(organization);

    // Create admin user
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName: firstName || 'Admin',
      lastName: lastName || 'User',
      roles: ['admin'],
      emailVerified: true,
      status: 'active' as UserStatus,
      organization,
    });

    return this.userRepository.save(user);
  }

  async findAllPaginated(options: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    status?: string;
    organizationId?: string;
    requestingUser: any;
  }) {
    const { page, limit, search, role, status, organizationId, requestingUser } = options;
    const skip = (page - 1) * limit;

    const query = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'organization')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .where('user.deletedAt IS NULL');

    // Filter by organization based on user permissions
    if (organizationId) {
      query.andWhere('user.organizationId = :organizationId', { organizationId });
    } else if (!this.hasGlobalAccess(requestingUser)) {
      // Non-super admins can only see users in their organization
      query.andWhere('user.organizationId = :orgId', { orgId: requestingUser.organizationId });
    }

    // Search filter
    if (search) {
      query.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Role filter
    if (role) {
      query.andWhere('role.name = :role', { role });
    }

    // Status filter
    if (status) {
      query.andWhere('user.status = :status', { status });
    }

    const [users, total] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Remove sensitive data
    const sanitizedUsers = users.map(user => this.sanitizeUser(user));

    return {
      data: sanitizedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['organization', 'userRoles', 'userRoles.role'],
    });
  }

  async findOneWithDetails(id: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: [
        'organization',
        'userRoles',
        'userRoles.role',
        'userRoles.role.rolePermissions',
        'userRoles.role.rolePermissions.permission',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get all permissions
    const permissions = this.getUserPermissions(user);

    return {
      ...this.sanitizeUser(user),
      permissions,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase() },
      relations: ['organization'],
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);
    }
  }

  async create(createUserDto: CreateUserDto, createdBy: any): Promise<any> {
    // Check if email already exists
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate organization
    const organization = await this.organizationRepository.findOne({
      where: { id: createUserDto.organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Validate password against policy
    const passwordPolicy = this.passwordPolicyService.getPolicy(organization);
    const passwordValidation = await this.passwordPolicyService.validatePassword(
      createUserDto.password,
      passwordPolicy,
      {
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      },
    );

    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors,
        score: passwordValidation.score,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      email: createUserDto.email.toLowerCase(),
      password: hashedPassword,
      status: UserStatus.ACTIVE,
      emailVerified: false,
    });

    try {
      const savedUser = await this.userRepository.save(user);

      // Assign default role if provided
      if (createUserDto.roleId) {
        await this.assignRole(savedUser.id, createUserDto.roleId, createdBy);
      }

      // Log audit event
      await this.createAuditLog({
        action: AuditAction.USER_CREATED,
        userId: createdBy?.id || savedUser.id, // Use the created user's ID if no createdBy
        targetUserId: savedUser.id,
        organizationId: savedUser.organizationId,
        metadata: { email: savedUser.email },
      });

      // Emit event
      this.eventEmitter.emit('user.created', {
        user: savedUser,
        createdBy,
      });

      return this.sanitizeUser(savedUser);
    } catch (error) {
      // Log the actual error for debugging
      console.error('User creation error:', error);
      throw new InternalServerErrorException({
        message: 'Failed to create user',
        error: error.message,
        details: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' ? error : undefined
      });
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto, updatedBy: any): Promise<any> {
    const user = await this.findOne(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If email is being updated, check for conflicts
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
      updateUserDto.email = updateUserDto.email.toLowerCase();
    }

    // If password is being updated, validate and hash it
    if (updateUserDto.password) {
      // Get user's organization for password policy
      const userWithOrg = await this.userRepository.findOne({
        where: { id },
        relations: ['organization'],
      });

      const passwordPolicy = this.passwordPolicyService.getPolicy(userWithOrg.organization);
      
      // Get previous passwords for reuse check
      const previousPasswords = userWithOrg.previousPasswords || [];
      
      const passwordValidation = await this.passwordPolicyService.validatePassword(
        updateUserDto.password,
        passwordPolicy,
        {
          email: updateUserDto.email || user.email,
          firstName: updateUserDto.firstName || user.firstName,
          lastName: updateUserDto.lastName || user.lastName,
          previousPasswords,
        },
      );

      if (!passwordValidation.isValid) {
        throw new BadRequestException({
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors,
          score: passwordValidation.score,
        });
      }

      // Check if password can be changed (minimum age)
      if (userWithOrg.passwordChangedAt) {
        const canChange = this.passwordPolicyService.canChangePassword(
          userWithOrg.passwordChangedAt,
          passwordPolicy,
        );
        
        if (!canChange) {
          throw new BadRequestException(
            `Password cannot be changed yet. Minimum password age is ${passwordPolicy.minAge} hours.`,
          );
        }
      }

      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 12);
      
      // Update password history
      if (userWithOrg.password) {
        user.previousPasswords = [
          userWithOrg.password,
          ...(previousPasswords.slice(0, passwordPolicy.preventReuse - 1)),
        ];
      }
      
      user.passwordChangedAt = new Date();
    }

    // Update user
    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    // Log audit event
    await this.createAuditLog({
      action: AuditAction.USER_UPDATED,
      userId: updatedBy.id,
      targetUserId: user.id,
      organizationId: user.organizationId,
      metadata: { updatedFields: Object.keys(updateUserDto) },
    });

    // Emit user.updated event
    this.eventEmitter.emit('user.updated', {
      user: this.sanitizeUser(updatedUser),
      updatedBy,
      updatedFields: Object.keys(updateUserDto),
    });

    return this.sanitizeUser(updatedUser);
  }

  async remove(id: string, deletedBy: any): Promise<void> {
    const user = await this.findOne(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete
    user.deletedAt = new Date();
    await this.userRepository.save(user);

    // Log audit event
    await this.createAuditLog({
      action: AuditAction.USER_DELETED,
      userId: deletedBy.id,
      targetUserId: user.id,
      organizationId: user.organizationId,
    });

    // Emit event
    this.eventEmitter.emit('user.deleted', {
      user,
      deletedBy,
    });
  }

  async suspend(id: string, suspendedBy: any): Promise<any> {
    const user = await this.findOne(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = UserStatus.SUSPENDED;
    const updatedUser = await this.userRepository.save(user);

    // Log audit event
    await this.createAuditLog({
      action: AuditAction.USER_SUSPENDED,
      userId: suspendedBy.id,
      targetUserId: user.id,
      organizationId: user.organizationId,
    });

    return this.sanitizeUser(updatedUser);
  }

  async activate(id: string, activatedBy: any): Promise<any> {
    const user = await this.findOne(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = UserStatus.ACTIVE;
    const updatedUser = await this.userRepository.save(user);

    // Log audit event
    await this.createAuditLog({
      action: AuditAction.USER_ACTIVATED,
      userId: activatedBy.id,
      targetUserId: user.id,
      organizationId: user.organizationId,
    });

    return this.sanitizeUser(updatedUser);
  }

  async inviteUser(inviteUserDto: InviteUserDto, invitedBy: any): Promise<any> {
    // Check if email already exists
    const existingUser = await this.findByEmail(inviteUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(12).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create user with pending status
    const user = this.userRepository.create({
      email: inviteUserDto.email.toLowerCase(),
      password: hashedPassword,
      firstName: inviteUserDto.firstName,
      lastName: inviteUserDto.lastName,
      organizationId: inviteUserDto.organizationId,
      status: UserStatus.PENDING,
      emailVerified: false,
      resetPasswordToken: crypto.randomBytes(32).toString('hex'),
      resetPasswordExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    const savedUser = await this.userRepository.save(user);

    // Assign role if provided
    if (inviteUserDto.roleId) {
      await this.assignRole(savedUser.id, inviteUserDto.roleId, invitedBy);
    }

    // Log audit event
    await this.createAuditLog({
      action: AuditAction.USER_INVITED,
      userId: invitedBy.id,
      targetUserId: savedUser.id,
      organizationId: savedUser.organizationId,
    });

    // Emit event for sending invitation email
    this.eventEmitter.emit('user.invited', {
      user: savedUser,
      invitedBy,
      inviteLink: `${process.env.FRONTEND_URL}/auth/accept-invite?token=${savedUser.resetPasswordToken}`,
    });

    return {
      id: savedUser.id,
      email: savedUser.email,
      status: savedUser.status,
      inviteLink: `${process.env.FRONTEND_URL}/auth/accept-invite?token=${savedUser.resetPasswordToken}`,
    };
  }

  async assignRole(userId: string, roleId: string, assignedBy: any): Promise<void> {
    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if user already has this role
    const existingUserRole = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });

    if (existingUserRole) {
      throw new ConflictException('User already has this role');
    }

    // Create user role
    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
      grantedBy: assignedBy.id,
    });

    await this.userRoleRepository.save(userRole);

    // Log audit event
    await this.createAuditLog({
      action: AuditAction.ROLE_ASSIGNED,
      userId: assignedBy.id,
      targetUserId: userId,
      organizationId: user.organizationId,
      metadata: { roleId, roleName: role.name },
    });
  }

  async removeRole(userId: string, roleId: string, removedBy: any): Promise<void> {
    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId },
      relations: ['role'],
    });

    if (!userRole) {
      throw new NotFoundException('User does not have this role');
    }

    await this.userRoleRepository.remove(userRole);

    // Log audit event
    await this.createAuditLog({
      action: AuditAction.ROLE_REMOVED,
      userId: removedBy.id,
      targetUserId: userId,
      organizationId: user.organizationId,
      metadata: { roleId, roleName: userRole.role.name },
    });
  }

  async unlock(id: string, unlockedBy: any): Promise<any> {
    const user = await this.findOne(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    const updatedUser = await this.userRepository.save(user);

    // Log audit event
    await this.createAuditLog({
      action: AuditAction.ACCOUNT_UNLOCKED,
      userId: unlockedBy.id,
      targetUserId: user.id,
      organizationId: user.organizationId,
    });

    return this.sanitizeUser(updatedUser);
  }

  async validateUserPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);

    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw new BadRequestException('Account is locked');
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts += 1;

      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await this.createAuditLog({
          action: AuditAction.ACCOUNT_LOCKED,
          userId: user.id,
          organizationId: user.organizationId,
          metadata: { reason: 'Too many failed login attempts' },
        });
      }

      await this.userRepository.save(user);
      return null;
    }

    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      await this.userRepository.save(user);
    }

    return user;
  }

  // Helper methods
  private sanitizeUser(user: User): any {
    const { password, mfaSecret, mfaBackupCodes, resetPasswordToken, ...sanitized } = user;
    return sanitized;
  }

  private getUserPermissions(user: User): string[] {
    const permissions = new Set<string>();

    user.userRoles?.forEach(userRole => {
      if (!userRole.isExpired()) {
        userRole.role?.rolePermissions?.forEach(rolePermission => {
          permissions.add(rolePermission.permission.code);
        });
      }
    });

    return Array.from(permissions);
  }

  canAccessUser(requestingUser: any, targetUser: User): boolean {
    // Super admins can access all users
    if (this.hasGlobalAccess(requestingUser)) {
      return true;
    }

    // Users can access users in their own organization
    return requestingUser.organizationId === targetUser.organizationId;
  }

  async canAccessOrganization(requestingUser: any, organizationId: string): Promise<boolean> {
    // Super admins can access all organizations
    if (this.hasGlobalAccess(requestingUser)) {
      return true;
    }

    // Check if user's organization matches or is a parent
    if (requestingUser.organizationId === organizationId) {
      return true;
    }

    // Check if target organization is a child of user's organization
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    return organization?.parentOrganizationId === requestingUser.organizationId;
  }

  private hasGlobalAccess(user: any): boolean {
    return user.roles?.some(role => role.name === 'super_admin' || role.name === 'msp_admin');
  }

  private async createAuditLog(data: Partial<AuditLog>): Promise<void> {
    const auditLog = this.auditLogRepository.create(data);
    await this.auditLogRepository.save(auditLog);
  }


  async count(): Promise<number> {
    return this.userRepository.count();
  }

  async updatePassword(
    userId: string, 
    hashedPassword: string,
    requestMetadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Create audit log with proper IP tracking
    await this.createAuditLog({
      userId,
      action: AuditAction.PASSWORD_CHANGED,
      targetResourceType: 'User',
      targetResourceId: userId,
      metadata: { passwordChanged: true },
      ipAddress: requestMetadata?.ipAddress || 'System',
      userAgent: requestMetadata?.userAgent || 'System',
      organizationId: user.organizationId,
    });

    this.eventEmitter.emit('user.passwordChanged', { userId });
  }
}