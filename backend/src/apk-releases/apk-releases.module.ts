import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApkReleasesController } from './apk-releases.controller';
import { ApkReleasesService } from './apk-releases.service';
import { ApkRelease } from '../database/entities/apk-release.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApkRelease]),
    AuthModule, // For ApkTokenService
    UsersModule, // For UsersService (apk_access grant/revoke/check)
  ],
  controllers: [ApkReleasesController],
  providers: [ApkReleasesService],
})
export class ApkReleasesModule {}
