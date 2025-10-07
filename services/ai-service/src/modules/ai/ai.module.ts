import { Module } from '@nestjs/common';
import { AuthCommonModule } from '@soc-compliance/auth-common';
import { AIController } from './ai.controller';

@Module({
  imports: [AuthCommonModule],
  controllers: [AIController],
  providers: [],
  exports: [],
})
export class AIModule {}
