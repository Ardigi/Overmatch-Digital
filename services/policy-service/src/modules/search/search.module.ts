import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SearchService } from './search.service';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // In test environment, return a minimal configuration
        if (process.env.NODE_ENV === 'test') {
          return {
            node: process.env.ELASTICSEARCH_NODE || 'http://127.0.0.1:9201',
            // Disable sniffing and other features that might fail in test
            sniffOnStart: false,
            sniffInterval: false,
            sniffOnConnectionFault: false,
            requestTimeout: 1000,
            pingTimeout: 1000,
          };
        }

        const esConfig = configService.get('policyService.elasticsearch');
        return {
          node: esConfig.node,
          auth: esConfig.apiKey
            ? {
                apiKey: esConfig.apiKey,
              }
            : undefined,
        };
      },
    }),
    ConfigModule,
  ],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
