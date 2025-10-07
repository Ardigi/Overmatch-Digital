import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Risk } from './entities/risk.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Risk])],
  controllers: [],
  providers: [],
  exports: [],
})
export class RisksModule {}
