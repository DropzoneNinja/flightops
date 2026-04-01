import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PreAuthorizedEmailsModule } from './pre-authorized-emails/pre-authorized-emails.module';
import { SitesModule } from './sites/sites.module';
import { SettingsModule } from './settings/settings.module';
import { WeatherModule } from './weather/weather.module';
import { AirspaceModule } from './airspace/airspace.module';
import { BackupModule } from './backup/backup.module';
import { MediaModule } from './media/media.module';
import { FlightsModule } from './flights/flights.module';
import { PilotsModule } from './pilots/pilots.module';
import { LeaderboardsModule } from './leaderboards/leaderboards.module';

@Module({
  imports: [
    // Global configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database connection with ConfigService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getDatabaseConfig(configService),
    }),

    // Scheduler for weather jobs
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    UsersModule,
    PreAuthorizedEmailsModule,
    SitesModule,
    SettingsModule,
    WeatherModule,
    AirspaceModule,
    BackupModule,
    MediaModule,
    FlightsModule,
    PilotsModule,
    LeaderboardsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
