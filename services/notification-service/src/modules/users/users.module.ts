import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { UserDataService } from './user-data.service';
import { CacheModule } from '@soc-compliance/cache-common';
import { CacheModule as AppCacheModule } from '../cache/cache.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    CacheModule,
    AppCacheModule,
  ],
  providers: [UserDataService],
  exports: [UserDataService],
})
export class UsersModule {}