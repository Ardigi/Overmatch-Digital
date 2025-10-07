import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../events/events.module';
import { SharedAuthModule } from '../shared-auth/shared-auth.module';
import { UsersModule } from '../users/users.module';
import { SsoProvider } from './entities/sso-provider.entity';
import { SsoSession } from './entities/sso-session.entity';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SsoProvider, SsoSession]),
    UsersModule,
    SharedAuthModule, // Use SharedAuthModule for guards and decorators
    EventsModule,
    JwtModule,
  ],
  controllers: [SsoController],
  providers: [SsoService],
  exports: [SsoService],
})
export class SsoModule {}
