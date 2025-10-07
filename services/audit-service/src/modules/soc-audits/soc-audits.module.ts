import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditFinding, AuditProgram, ControlTest, SOCAudit } from './entities';
import { SOCAuditsController } from './soc-audits.controller';
import { SOCAuditsService } from './soc-audits.service';

@Module({
  imports: [TypeOrmModule.forFeature([SOCAudit, AuditFinding, ControlTest, AuditProgram])],
  controllers: [SOCAuditsController],
  providers: [SOCAuditsService],
  exports: [SOCAuditsService, TypeOrmModule],
})
export class SOCAuditsModule {}
