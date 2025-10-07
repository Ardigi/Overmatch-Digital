import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenceRequest } from './entities/evidence-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EvidenceRequest])],
  controllers: [],
  providers: [],
  exports: [],
})
export class RequestsModule {}
