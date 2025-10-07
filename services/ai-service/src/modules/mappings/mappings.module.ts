import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FrameworkMapping } from './entities/framework-mapping.entity';
import { MappingsController } from './mappings.controller';
import { MappingsService } from './mappings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FrameworkMapping]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [MappingsController],
  providers: [MappingsService],
  exports: [MappingsService],
})
export class MappingsModule {}
