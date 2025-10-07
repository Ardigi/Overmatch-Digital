import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationRule } from './entities/validation-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ValidationRule])],
  controllers: [],
  providers: [],
  exports: [],
})
export class ValidationModule {}
