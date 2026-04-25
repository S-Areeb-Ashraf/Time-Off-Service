import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceModule } from './balance/balance.module';
import { RequestModule } from './request/request.module';
import { SyncModule } from './sync/sync.module';
import { HcmModule } from './hcm/hcm.module';
import { TimeOffBalance } from './balance/balance.entity';
import { TimeOffRequest } from './request/request.entity';
import { SyncLog } from './sync/sync-log.entity';
import { DevModule } from './dev/dev.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DATABASE_PATH ?? './time-off.sqlite',
      entities: [TimeOffBalance, TimeOffRequest, SyncLog],
      synchronize: true, // auto-create tables (fine for dev/sqlite)
      logging: process.env.NODE_ENV === 'development',
    }),
    HcmModule,
    BalanceModule,
    RequestModule,
    SyncModule,
    DevModule,
  ],
})
export class AppModule {}
