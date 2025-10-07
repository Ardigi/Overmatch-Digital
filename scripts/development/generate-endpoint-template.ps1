# SOC Compliance Platform - Endpoint Template Generator
# Purpose: Rapidly generate enterprise-grade endpoints with full testing
# Author: SOC Compliance Development Team
# Version: 1.0.0

param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceName,
    
    [Parameter(Mandatory=$true)]
    [string]$EntityName,
    
    [Parameter(Mandatory=$false)]
    [string[]]$Operations = @("create", "read", "update", "delete", "list"),
    
    [switch]$GenerateTests,
    [switch]$GenerateIntegrationTests,
    [switch]$GenerateE2ETests,
    [switch]$GenerateSwaggerDocs,
    [switch]$DryRun,
    [switch]$Verbose
)

# Configuration
$script:Config = @{
    ServicesPath = ".\services"
    SharedPath = ".\shared"
    PackagesPath = ".\packages"
}

# Validate service exists
$servicePath = Join-Path $Config.ServicesPath "$ServiceName-service"
if (!(Test-Path $servicePath)) {
    Write-Host "❌ Service not found: $ServiceName-service" -ForegroundColor Red
    Write-Host "Available services:" -ForegroundColor Yellow
    Get-ChildItem $Config.ServicesPath -Directory | ForEach-Object { 
        Write-Host "  - $($_.Name -replace '-service', '')" -ForegroundColor Gray
    }
    exit 1
}

Write-Host ""
Write-Host "🚀 SOC Compliance Endpoint Generator" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service: $ServiceName" -ForegroundColor White
Write-Host "Entity: $EntityName" -ForegroundColor White
Write-Host "Operations: $($Operations -join ', ')" -ForegroundColor White
Write-Host ""

if ($DryRun) {
    Write-Host "⚠️  DRY RUN MODE - No files will be created" -ForegroundColor Yellow
    Write-Host ""
}

# Convert entity name to various cases
$entityLower = $EntityName.ToLower()
$entityUpper = $EntityName.ToUpper()
$entityCamel = $EntityName.Substring(0,1).ToLower() + $EntityName.Substring(1)
$entityPlural = if ($entityLower -match "[sx]$") { "${entityLower}es" } else { "${entityLower}s" }

# Paths
$modulePath = Join-Path $servicePath "src\modules\$entityPlural"
$controllerPath = Join-Path $modulePath "$entityPlural.controller.ts"
$servicePath = Join-Path $modulePath "$entityPlural.service.ts"
$modulePath = Join-Path $modulePath "$entityPlural.module.ts"
$entityPath = Join-Path $modulePath "entities\$entityLower.entity.ts"
$dtoPath = Join-Path $modulePath "dto"
$testPath = Join-Path $modulePath "__tests__"

# Generate Controller
$controllerContent = @"
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Observable, Traced, Metered } from '@soc-compliance/monitoring';
import { Cacheable } from '@soc-compliance/cache-common';
import { AuthGuard } from '@soc-compliance/auth-common';
import { ${EntityName}Service } from './${entityPlural}.service';
import { Create${EntityName}Dto } from './dto/create-${entityLower}.dto';
import { Update${EntityName}Dto } from './dto/update-${entityLower}.dto';
import { ${EntityName} } from './entities/${entityLower}.entity';
import { getRequestMetadata } from '../../common/utils/request-utils';

@Controller('api/v1/${entityPlural}')
@ApiTags('${EntityName}')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ${EntityName}Controller {
  constructor(private readonly ${entityCamel}Service: ${EntityName}Service) {}
"@

if ($Operations -contains "create") {
    $controllerContent += @"

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Observable({ 
    spanName: '${entityLower}-create', 
    metricName: '${ServiceName}_${entityLower}_create_duration_seconds' 
  })
  @ApiOperation({ summary: 'Create new ${entityLower}' })
  @ApiResponse({ status: 201, description: '${EntityName} created successfully', type: ${EntityName} })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() create${EntityName}Dto: Create${EntityName}Dto,
    @Request() req: any
  ): Promise<${EntityName}> {
    const requestMetadata = getRequestMetadata(req);
    return await this.${entityCamel}Service.create(
      create${EntityName}Dto,
      req.user.id,
      req.user.organizationId,
      requestMetadata
    );
  }
"@
}

if ($Operations -contains "list") {
    $controllerContent += @"

  @Get()
  @Traced('${entityLower}-list')
  @ApiOperation({ summary: 'List all ${entityPlural}' })
  @ApiResponse({ status: 200, description: 'List of ${entityPlural}', type: [${EntityName}] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC',
    @Request() req: any
  ): Promise<{ data: ${EntityName}[]; total: number; page: number; limit: number }> {
    return await this.${entityCamel}Service.findAll({
      organizationId: req.user.organizationId,
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    });
  }
"@
}

if ($Operations -contains "read") {
    $controllerContent += @"

  @Get(':id')
  @Metered('${ServiceName}_${entityLower}_get_duration_seconds')
  @ApiOperation({ summary: 'Get ${entityLower} by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: '${EntityName} details', type: ${EntityName} })
  @ApiResponse({ status: 404, description: '${EntityName} not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: any
  ): Promise<${EntityName}> {
    const ${entityCamel} = await this.${entityCamel}Service.findOne(id, req.user.organizationId);
    if (!${entityCamel}) {
      throw new NotFoundException(`${EntityName} with ID \${id} not found`);
    }
    return ${entityCamel};
  }
"@
}

if ($Operations -contains "update") {
    $controllerContent += @"

  @Put(':id')
  @Observable({ 
    spanName: '${entityLower}-update', 
    metricName: '${ServiceName}_${entityLower}_update_duration_seconds' 
  })
  @ApiOperation({ summary: 'Update ${entityLower}' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: '${EntityName} updated successfully', type: ${EntityName} })
  @ApiResponse({ status: 404, description: '${EntityName} not found' })
  async update(
    @Param('id') id: string,
    @Body() update${EntityName}Dto: Update${EntityName}Dto,
    @Request() req: any
  ): Promise<${EntityName}> {
    const requestMetadata = getRequestMetadata(req);
    return await this.${entityCamel}Service.update(
      id,
      update${EntityName}Dto,
      req.user.id,
      req.user.organizationId,
      requestMetadata
    );
  }
"@
}

if ($Operations -contains "delete") {
    $controllerContent += @"

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Traced('${entityLower}-delete')
  @ApiOperation({ summary: 'Delete ${entityLower}' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: '${EntityName} deleted successfully' })
  @ApiResponse({ status: 404, description: '${EntityName} not found' })
  async remove(
    @Param('id') id: string,
    @Request() req: any
  ): Promise<void> {
    const requestMetadata = getRequestMetadata(req);
    await this.${entityCamel}Service.remove(
      id,
      req.user.id,
      req.user.organizationId,
      requestMetadata
    );
  }
"@
}

$controllerContent += @"

}
"@

# Generate Service
$serviceContent = @"
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindManyOptions } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectSecret } from '@soc-compliance/secrets';
import { Cacheable } from '@soc-compliance/cache-common';
import { ${EntityName} } from './entities/${entityLower}.entity';
import { Create${EntityName}Dto } from './dto/create-${entityLower}.dto';
import { Update${EntityName}Dto } from './dto/update-${entityLower}.dto';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { AuditAction } from '../audit/audit.types';

@Injectable()
export class ${EntityName}Service {
  constructor(
    @InjectRepository(${EntityName})
    private readonly ${entityCamel}Repository: Repository<${EntityName}>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly eventEmitter: EventEmitter2,
    @InjectSecret('database.encryption.key')
    private readonly encryptionKey: string
  ) {}

  async create(
    create${EntityName}Dto: Create${EntityName}Dto,
    userId: string,
    organizationId: string,
    requestMetadata?: any
  ): Promise<${EntityName}> {
    const ${entityCamel} = this.${entityCamel}Repository.create({
      ...create${EntityName}Dto,
      organizationId,
      createdBy: userId,
    });

    const saved${EntityName} = await this.${entityCamel}Repository.save(${entityCamel});

    // Create audit log
    await this.createAuditLog({
      userId,
      action: AuditAction.${entityUpper}_CREATED,
      targetResourceType: '${EntityName}',
      targetResourceId: saved${EntityName}.id,
      organizationId,
      metadata: { ...create${EntityName}Dto },
      ipAddress: requestMetadata?.ipAddress,
      userAgent: requestMetadata?.userAgent,
    });

    // Emit event
    this.eventEmitter.emit('${ServiceName}.${entityLower}.created', {
      ${entityCamel}Id: saved${EntityName}.id,
      organizationId,
      userId,
      timestamp: new Date(),
    });

    return saved${EntityName};
  }

  @Cacheable({ key: '${entityLower}-list', ttl: 300, service: '${ServiceName}' })
  async findAll(params: {
    organizationId: string;
    page: number;
    limit: number;
    search?: string;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
  }): Promise<{ data: ${EntityName}[]; total: number; page: number; limit: number }> {
    const { organizationId, page, limit, search, sortBy, sortOrder } = params;
    
    const where: any = { organizationId };
    
    if (search) {
      where.name = Like(`%\${search}%`);
    }

    const [data, total] = await this.${entityCamel}Repository.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, organizationId: string): Promise<${EntityName} | null> {
    return await this.${entityCamel}Repository.findOne({
      where: { id, organizationId },
    });
  }

  async update(
    id: string,
    update${EntityName}Dto: Update${EntityName}Dto,
    userId: string,
    organizationId: string,
    requestMetadata?: any
  ): Promise<${EntityName}> {
    const ${entityCamel} = await this.findOne(id, organizationId);
    
    if (!${entityCamel}) {
      throw new NotFoundException(`${EntityName} with ID \${id} not found`);
    }

    Object.assign(${entityCamel}, update${EntityName}Dto);
    ${entityCamel}.updatedBy = userId;
    
    const updated${EntityName} = await this.${entityCamel}Repository.save(${entityCamel});

    // Create audit log
    await this.createAuditLog({
      userId,
      action: AuditAction.${entityUpper}_UPDATED,
      targetResourceType: '${EntityName}',
      targetResourceId: id,
      organizationId,
      metadata: { changes: update${EntityName}Dto },
      ipAddress: requestMetadata?.ipAddress,
      userAgent: requestMetadata?.userAgent,
    });

    // Emit event
    this.eventEmitter.emit('${ServiceName}.${entityLower}.updated', {
      ${entityCamel}Id: id,
      organizationId,
      userId,
      changes: update${EntityName}Dto,
      timestamp: new Date(),
    });

    return updated${EntityName};
  }

  async remove(
    id: string,
    userId: string,
    organizationId: string,
    requestMetadata?: any
  ): Promise<void> {
    const ${entityCamel} = await this.findOne(id, organizationId);
    
    if (!${entityCamel}) {
      throw new NotFoundException(`${EntityName} with ID \${id} not found`);
    }

    // Soft delete
    ${entityCamel}.deletedAt = new Date();
    ${entityCamel}.deletedBy = userId;
    await this.${entityCamel}Repository.save(${entityCamel});

    // Create audit log
    await this.createAuditLog({
      userId,
      action: AuditAction.${entityUpper}_DELETED,
      targetResourceType: '${EntityName}',
      targetResourceId: id,
      organizationId,
      ipAddress: requestMetadata?.ipAddress,
      userAgent: requestMetadata?.userAgent,
    });

    // Emit event
    this.eventEmitter.emit('${ServiceName}.${entityLower}.deleted', {
      ${entityCamel}Id: id,
      organizationId,
      userId,
      timestamp: new Date(),
    });
  }

  private async createAuditLog(data: Partial<AuditLog>): Promise<void> {
    const auditLog = this.auditLogRepository.create(data);
    await this.auditLogRepository.save(auditLog);
  }
}
"@

# Generate Entity
$entityContent = @"
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('${entityPlural}')
@Index(['organizationId', 'deletedAt'])
export class ${EntityName} {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '${EntityName} name' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ description: 'Description', required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: 'Status' })
  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @ApiProperty({ description: 'Organization ID' })
  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @ApiProperty({ description: 'Created by user ID' })
  @Column({ type: 'uuid' })
  createdBy: string;

  @ApiProperty({ description: 'Updated by user ID', required: false })
  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string;

  @ApiProperty({ description: 'Deleted by user ID', required: false })
  @Column({ type: 'uuid', nullable: true })
  deletedBy?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({ description: 'Deletion timestamp', required: false })
  @DeleteDateColumn()
  deletedAt?: Date;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}
"@

# Generate DTOs
$createDtoContent = @"
import { IsString, IsOptional, IsObject, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Create${EntityName}Dto {
  @ApiProperty({ 
    description: '${EntityName} name',
    minLength: 3,
    maxLength: 255,
    example: 'Example ${EntityName}'
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ 
    description: 'Description',
    example: 'This is a description'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Additional metadata',
    example: { key: 'value' }
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
"@

$updateDtoContent = @"
import { PartialType } from '@nestjs/swagger';
import { Create${EntityName}Dto } from './create-${entityLower}.dto';
import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class Update${EntityName}Dto extends PartialType(Create${EntityName}Dto) {
  @ApiPropertyOptional({ 
    description: 'Status',
    enum: ['active', 'inactive', 'archived'],
    example: 'active'
  })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive', 'archived'])
  status?: string;
}
"@

# Generate Module
$moduleContent = @"
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${EntityName}Controller } from './${entityPlural}.controller';
import { ${EntityName}Service } from './${entityPlural}.service';
import { ${EntityName} } from './entities/${entityLower}.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([${EntityName}, AuditLog])],
  controllers: [${EntityName}Controller],
  providers: [${EntityName}Service],
  exports: [${EntityName}Service],
})
export class ${EntityName}Module {}
"@

# Generate Unit Tests
$unitTestContent = @"
import { Test, TestingModule } from '@nestjs/testing';
import { ${EntityName}Controller } from '../${entityPlural}.controller';
import { ${EntityName}Service } from '../${entityPlural}.service';
import { Create${EntityName}Dto } from '../dto/create-${entityLower}.dto';
import { Update${EntityName}Dto } from '../dto/update-${entityLower}.dto';

describe('${EntityName}Controller', () => {
  let controller: ${EntityName}Controller;
  let service: ${EntityName}Service;
  
  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockAuditRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      organizationId: 'org-123',
    },
    headers: {},
    ip: '127.0.0.1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Manual instantiation for TypeORM compatibility
    service = new ${EntityName}Service(
      mockRepository as any,
      mockAuditRepository as any,
      mockEventEmitter as any,
      'test-encryption-key'
    );
    
    controller = new ${EntityName}Controller(service);
  });

  describe('create', () => {
    it('should create a new ${entityLower}', async () => {
      const create${EntityName}Dto: Create${EntityName}Dto = {
        name: 'Test ${EntityName}',
        description: 'Test description',
      };

      const expected${EntityName} = {
        id: 'uuid-123',
        ...create${EntityName}Dto,
        organizationId: 'org-123',
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(expected${EntityName});
      mockRepository.save.mockResolvedValue(expected${EntityName});
      mockAuditRepository.create.mockReturnValue({});
      mockAuditRepository.save.mockResolvedValue({});

      const result = await controller.create(create${EntityName}Dto, mockRequest);

      expect(result).toEqual(expected${EntityName});
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...create${EntityName}Dto,
          organizationId: 'org-123',
          createdBy: 'user-123',
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        '${ServiceName}.${entityLower}.created',
        expect.any(Object)
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated ${entityPlural}', async () => {
      const ${entityPlural} = [
        { id: '1', name: '${EntityName} 1' },
        { id: '2', name: '${EntityName} 2' },
      ];

      mockRepository.findAndCount.mockResolvedValue([${entityPlural}, 2]);

      const result = await controller.findAll(1, 10, undefined, 'createdAt', 'DESC', mockRequest);

      expect(result).toEqual({
        data: ${entityPlural},
        total: 2,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('findOne', () => {
    it('should return a single ${entityLower}', async () => {
      const ${entityCamel} = { id: 'uuid-123', name: 'Test ${EntityName}' };
      
      jest.spyOn(service, 'findOne').mockResolvedValue(${entityCamel} as any);

      const result = await controller.findOne('uuid-123', mockRequest);

      expect(result).toEqual(${entityCamel});
      expect(service.findOne).toHaveBeenCalledWith('uuid-123', 'org-123');
    });

    it('should throw NotFoundException when ${entityLower} not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(
        controller.findOne('non-existent', mockRequest)
      ).rejects.toThrow('${EntityName} with ID non-existent not found');
    });
  });

  describe('update', () => {
    it('should update an existing ${entityLower}', async () => {
      const update${EntityName}Dto: Update${EntityName}Dto = {
        name: 'Updated ${EntityName}',
      };

      const updated${EntityName} = {
        id: 'uuid-123',
        ...update${EntityName}Dto,
        updatedBy: 'user-123',
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'update').mockResolvedValue(updated${EntityName} as any);

      const result = await controller.update('uuid-123', update${EntityName}Dto, mockRequest);

      expect(result).toEqual(updated${EntityName});
      expect(service.update).toHaveBeenCalledWith(
        'uuid-123',
        update${EntityName}Dto,
        'user-123',
        'org-123',
        expect.any(Object)
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a ${entityLower}', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      await controller.remove('uuid-123', mockRequest);

      expect(service.remove).toHaveBeenCalledWith(
        'uuid-123',
        'user-123',
        'org-123',
        expect.any(Object)
      );
    });
  });
});
"@

# Function to write file
function Write-FileContent {
    param(
        [string]$Path,
        [string]$Content
    )
    
    if ($DryRun) {
        Write-Host "  Would create: $Path" -ForegroundColor Gray
        return
    }
    
    $directory = Split-Path $Path -Parent
    if (!(Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    
    $Content | Out-File -FilePath $Path -Encoding UTF8
    Write-Host "  ✅ Created: $Path" -ForegroundColor Green
}

# Create files
Write-Host "📁 Creating module structure..." -ForegroundColor Cyan
Write-FileContent -Path $controllerPath -Content $controllerContent
Write-FileContent -Path $servicePath -Content $serviceContent
Write-FileContent -Path $modulePath -Content $moduleContent
Write-FileContent -Path $entityPath -Content $entityContent
Write-FileContent -Path (Join-Path $dtoPath "create-${entityLower}.dto.ts") -Content $createDtoContent
Write-FileContent -Path (Join-Path $dtoPath "update-${entityLower}.dto.ts") -Content $updateDtoContent

if ($GenerateTests) {
    Write-Host ""
    Write-Host "🧪 Creating test files..." -ForegroundColor Cyan
    Write-FileContent -Path (Join-Path $testPath "${entityPlural}.controller.spec.ts") -Content $unitTestContent
}

# Generate integration test
if ($GenerateIntegrationTests) {
    $integrationTestContent = @"
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${EntityName}Controller } from '../${entityPlural}.controller';
import { ${EntityName}Service } from '../${entityPlural}.service';
import { ${EntityName} } from '../entities/${entityLower}.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { EventEmitterModule } from '@nestjs/event-emitter';

describe('${EntityName}Controller Integration Tests', () => {
  let app: TestingModule;
  let controller: ${EntityName}Controller;
  let service: ${EntityName}Service;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: '127.0.0.1',
          port: 5432,
          username: 'soc_user',
          password: 'soc_pass',
          database: 'soc_${ServiceName}_test',
          entities: [${EntityName}, AuditLog],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([${EntityName}, AuditLog]),
      ],
      controllers: [${EntityName}Controller],
      providers: [${EntityName}Service],
    }).compile();

    controller = app.get<${EntityName}Controller>(${EntityName}Controller);
    service = app.get<${EntityName}Service>(${EntityName}Service);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Full CRUD workflow', () => {
    it('should create, read, update, and delete ${entityLower}', async () => {
      const mockRequest = {
        user: { id: 'test-user', organizationId: 'test-org' },
        headers: {},
        ip: '127.0.0.1',
      };

      // Create
      const createDto = { name: 'Integration Test ${EntityName}', description: 'Test' };
      const created = await controller.create(createDto, mockRequest);
      expect(created.id).toBeDefined();
      expect(created.name).toBe(createDto.name);

      // Read
      const found = await controller.findOne(created.id, mockRequest);
      expect(found).toEqual(created);

      // Update
      const updateDto = { name: 'Updated ${EntityName}' };
      const updated = await controller.update(created.id, updateDto, mockRequest);
      expect(updated.name).toBe(updateDto.name);

      // Delete
      await controller.remove(created.id, mockRequest);
      await expect(controller.findOne(created.id, mockRequest)).rejects.toThrow();
    });
  });
});
"@
    
    Write-FileContent -Path (Join-Path $testPath "${entityPlural}.integration.spec.ts") -Content $integrationTestContent
}

# Update module imports in app.module.ts
if (!$DryRun) {
    $appModulePath = Join-Path $servicePath "src\app.module.ts"
    if (Test-Path $appModulePath) {
        Write-Host ""
        Write-Host "📝 Updating app.module.ts..." -ForegroundColor Cyan
        
        $appModuleContent = Get-Content $appModulePath -Raw
        
        # Add import statement
        $importStatement = "import { ${EntityName}Module } from './modules/${entityPlural}/${entityPlural}.module';"
        if ($appModuleContent -notmatch [regex]::Escape($importStatement)) {
            $appModuleContent = $appModuleContent -replace "(import.*?Module.*?';)", "`$1`n$importStatement"
        }
        
        # Add to imports array
        if ($appModuleContent -match "imports:\s*\[([^\]]+)\]") {
            $importsContent = $matches[1]
            if ($importsContent -notmatch "${EntityName}Module") {
                $newImportsContent = $importsContent.TrimEnd() + ",`n    ${EntityName}Module"
                $appModuleContent = $appModuleContent -replace "imports:\s*\[([^\]]+)\]", "imports: [$newImportsContent`n  ]"
            }
        }
        
        $appModuleContent | Out-File -FilePath $appModulePath -Encoding UTF8
        Write-Host "  ✅ Updated app.module.ts" -ForegroundColor Green
    }
}

# Summary
Write-Host ""
Write-Host "✅ Endpoint generation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  • Service: $ServiceName" -ForegroundColor White
Write-Host "  • Entity: $EntityName" -ForegroundColor White
Write-Host "  • Operations: $($Operations.Count)" -ForegroundColor White
Write-Host "  • Files created: $(if ($DryRun) { '0 (DRY RUN)' } else { '7+' })" -ForegroundColor White
Write-Host ""

if (!$DryRun) {
    Write-Host "🚀 Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Run database migration to create the table:" -ForegroundColor White
    Write-Host "     cd services\$ServiceName-service" -ForegroundColor Gray
    Write-Host "     npm run migration:generate -- -n Create${EntityName}Table" -ForegroundColor Gray
    Write-Host "     npm run migration:run" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Add to audit types if needed:" -ForegroundColor White
    Write-Host "     Edit: services\$ServiceName-service\src\modules\audit\audit.types.ts" -ForegroundColor Gray
    Write-Host "     Add: ${entityUpper}_CREATED, ${entityUpper}_UPDATED, ${entityUpper}_DELETED" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Test the endpoints:" -ForegroundColor White
    Write-Host "     npm test" -ForegroundColor Gray
    Write-Host "     npm run start:dev" -ForegroundColor Gray
    Write-Host ""
}

exit 0