import {
  Controller,
  Get,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@soc-compliance/auth-common';
import { FrameworksService } from './frameworks.service';

@ApiTags('frameworks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/frameworks')
export class FrameworksController {
  constructor(private readonly frameworksService: FrameworksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all supported frameworks' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Frameworks retrieved successfully',
  })
  async findAll() {
    return this.frameworksService.findAll();
  }

  @Get(':name')
  @ApiOperation({ summary: 'Get framework by name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Framework retrieved successfully',
  })
  async findOne(@Param('name') name: string) {
    return this.frameworksService.findOne(name);
  }

  @Get(':name/requirements')
  @ApiOperation({ summary: 'Get framework requirements' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Requirements retrieved successfully',
  })
  async getRequirements(@Param('name') name: string) {
    return this.frameworksService.getFrameworkRequirements(name);
  }
}