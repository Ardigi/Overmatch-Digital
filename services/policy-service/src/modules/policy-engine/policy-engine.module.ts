import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyEvaluator } from './evaluators/policy.evaluator';
import { PolicyLanguageParser } from './parsers/policy-language.parser';
import { PolicyEngineController } from './policy-engine.controller';
import { PolicyEngineService } from './policy-engine.service';
import { PolicyTemplateService } from './policy-template.service';

@Module({
  imports: [TypeOrmModule.forFeature([Policy])],
  controllers: [PolicyEngineController],
  providers: [PolicyEngineService, PolicyLanguageParser, PolicyEvaluator, PolicyTemplateService],
  exports: [PolicyEngineService, PolicyTemplateService],
})
export class PolicyEngineModule {}
