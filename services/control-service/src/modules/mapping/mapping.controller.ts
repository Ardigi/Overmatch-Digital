import {
  Controller,
  Get,
  HttpStatus,
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
import { MappingService } from './mapping.service';

@ApiTags('control-mapping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('control-mapping')
export class MappingController {
  constructor(private readonly mappingService: MappingService) {}

  @Get('map')
  @ApiOperation({ summary: 'Map controls between frameworks' })
  @ApiQuery({ name: 'source', required: true, description: 'Source framework' })
  @ApiQuery({ name: 'target', required: true, description: 'Target framework' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mapping generated successfully',
  })
  async mapFrameworks(
    @Query('source') source: string,
    @Query('target') target: string,
  ) {
    return this.mappingService.mapControlsToFramework(source, target);
  }

  @Get('matrix')
  @ApiOperation({ summary: 'Generate cross-reference matrix' })
  @ApiQuery({ name: 'frameworks', required: true, isArray: true, description: 'Frameworks to include' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Matrix generated successfully',
  })
  async generateMatrix(@Query('frameworks') frameworks: string[]) {
    return this.mappingService.generateCrossReferenceMatrix(frameworks);
  }

  @Get('gaps')
  @ApiOperation({ summary: 'Find gaps between frameworks' })
  @ApiQuery({ name: 'current', required: true, description: 'Current framework' })
  @ApiQuery({ name: 'target', required: true, description: 'Target framework' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Gap analysis completed successfully',
  })
  async findGaps(
    @Query('current') current: string,
    @Query('target') target: string,
  ) {
    return this.mappingService.findGapsBetweenFrameworks(current, target);
  }
}