import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Framework } from './entities/framework.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Framework])],
  controllers: [],
  providers: [],
  exports: [],
})
export class FrameworksModule {}
