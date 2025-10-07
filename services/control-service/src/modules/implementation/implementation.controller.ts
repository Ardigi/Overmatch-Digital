import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@soc-compliance/auth-common';
import type { CreateImplementationDto } from './dto/create-implementation.dto';
import type { UpdateImplementationDto } from './dto/update-implementation.dto';
import { QueryImplementationDto } from './dto/query-implementation.dto';
import { ImplementationService } from './implementation.service';

@ApiTags('control-implementation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/control-implementation')
export class ImplementationController {
  constructor(private readonly implementationService: ImplementationService) {}

  @Post()
  @ApiOperation({ summary: 'Create control implementation' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Control implementation created successfully',
  })
  async create(@Body() createImplementationDto: CreateImplementationDto) {
    return this.implementationService.create(createImplementationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all implementations for organization' })
  @ApiQuery({ name: 'organizationId', required: true })
  @ApiQuery({ name: 'controlId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'maturityLevel', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Implementations retrieved successfully',
  })
  async findAll(@Query() query: QueryImplementationDto) {
    const { organizationId, ...filters } = query;
    return this.implementationService.findAll(organizationId, filters);
  }

  @Get('metrics/:organizationId')
  @ApiOperation({ summary: 'Get implementation metrics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Metrics retrieved successfully',
  })
  async getMetrics(@Param('organizationId') organizationId: string) {
    return this.implementationService.getImplementationMetrics(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get implementation by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Implementation retrieved successfully',
  })
  async findOne(@Param('id') id: string) {
    return this.implementationService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update implementation' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Implementation updated successfully',
  })
  async update(
    @Param('id') id: string,
    @Body() updateImplementationDto: UpdateImplementationDto,
  ) {
    return this.implementationService.update(id, updateImplementationDto);
  }

  @Post(':id/gaps')
  @ApiOperation({ summary: 'Add gap to implementation' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Gap added successfully',
  })
  async addGap(@Param('id') id: string, @Body() gap: any) {
    return this.implementationService.addGap(id, gap);
  }

  @Put(':id/effectiveness')
  @ApiOperation({ summary: 'Update implementation effectiveness' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Effectiveness updated successfully',
  })
  async updateEffectiveness(
    @Param('id') id: string,
    @Body() effectiveness: any,
  ) {
    return this.implementationService.updateEffectiveness(id, effectiveness);
  }

  @Post(':id/schedule-review')
  @ApiOperation({ summary: 'Schedule implementation review' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Review scheduled successfully',
  })
  async scheduleReview(
    @Param('id') id: string,
    @Body() body: { reviewDate: Date },
  ) {
    return this.implementationService.scheduleReview(id, body.reviewDate);
  }
}