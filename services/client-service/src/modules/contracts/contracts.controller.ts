import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../../shared/auth-common';
import { ContractsService } from './contracts.service';
import type {
  AddLineItemDto,
  CreateContractDto,
  QueryContractDto,
  UpdateContractDto,
  UpdateLineItemDto,
} from './dto';

@Controller('api/v1/contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Roles('admin', 'account_manager', 'contract_manager')
  create(@Body() createContractDto: CreateContractDto, @Request() req) {
    return this.contractsService.create(createContractDto, req.user.id);
  }

  @Get()
  @Roles('admin', 'account_manager', 'contract_manager', 'auditor', 'analyst')
  findAll(@Query() query: QueryContractDto) {
    return this.contractsService.findAll(query);
  }

  @Get('metrics')
  @Roles('admin', 'account_manager', 'contract_manager', 'analyst')
  getMetrics(@Query('clientId') clientId?: string) {
    return this.contractsService.getContractMetrics(clientId);
  }

  @Get('expiring')
  @Roles('admin', 'account_manager', 'contract_manager')
  getExpiringContracts(@Query('daysAhead') daysAhead?: string) {
    const days = daysAhead ? parseInt(daysAhead) : 90;
    return this.contractsService.getExpiringContracts(days);
  }

  @Get(':id')
  @Roles('admin', 'account_manager', 'contract_manager', 'auditor', 'analyst')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'account_manager', 'contract_manager')
  update(
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
    @Request() req,
  ) {
    return this.contractsService.update(id, updateContractDto, req.user.id);
  }

  @Post(':id/sign')
  @Roles('admin', 'account_manager', 'contract_manager')
  sign(
    @Param('id') id: string,
    @Body() signatureData: {
      clientSignatory: string;
      clientSignatoryTitle: string;
      clientSignatoryEmail: string;
      mspSignatory: string;
      mspSignatoryTitle: string;
    },
    @Request() req,
  ) {
    return this.contractsService.sign(id, signatureData, req.user.id);
  }

  @Post(':id/activate')
  @Roles('admin', 'account_manager', 'contract_manager')
  activate(@Param('id') id: string, @Request() req) {
    return this.contractsService.activate(id, req.user.id);
  }

  @Post(':id/terminate')
  @Roles('admin', 'account_manager', 'contract_manager')
  terminate(
    @Param('id') id: string,
    @Body() terminationData: {
      reason: string;
      effectiveDate: Date;
    },
    @Request() req,
  ) {
    return this.contractsService.terminate(
      id,
      terminationData.reason,
      terminationData.effectiveDate,
      req.user.id,
    );
  }

  @Post(':id/renew')
  @Roles('admin', 'account_manager', 'contract_manager')
  renew(
    @Param('id') id: string,
    @Body() renewalData: {
      newEndDate: Date;
      priceAdjustment?: number;
      notes?: string;
    },
    @Request() req,
  ) {
    return this.contractsService.renew(id, renewalData, req.user.id);
  }

  @Post(':id/line-items')
  @Roles('admin', 'account_manager', 'contract_manager')
  addLineItem(
    @Param('id') id: string,
    @Body() addLineItemDto: AddLineItemDto,
    @Request() req,
  ) {
    return this.contractsService.addLineItem(id, addLineItemDto, req.user.id);
  }

  @Patch(':id/line-items/:lineItemId')
  @Roles('admin', 'account_manager', 'contract_manager')
  updateLineItem(
    @Param('id') id: string,
    @Param('lineItemId') lineItemId: string,
    @Body() updateLineItemDto: UpdateLineItemDto,
    @Request() req,
  ) {
    return this.contractsService.updateLineItem(
      id,
      lineItemId,
      updateLineItemDto,
      req.user.id,
    );
  }

  @Delete(':id/line-items/:lineItemId')
  @Roles('admin', 'account_manager', 'contract_manager')
  removeLineItem(
    @Param('id') id: string,
    @Param('lineItemId') lineItemId: string,
    @Request() req,
  ) {
    return this.contractsService.removeLineItem(id, lineItemId, req.user.id);
  }
}