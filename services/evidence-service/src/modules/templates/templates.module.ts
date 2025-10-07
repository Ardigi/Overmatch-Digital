import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenceTemplate } from './entities/evidence-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EvidenceTemplate])],
  controllers: [],
  providers: [],
  exports: [],
})
export class TemplatesModule {}
