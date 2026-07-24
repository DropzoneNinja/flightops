import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../database/entities/user.entity';
import { Media } from '../database/entities/media.entity';
import { Pilot } from '../database/entities/pilot.entity';
import { ApkAccess } from '../database/entities/apk-access.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Media, Pilot, ApkAccess])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export for use in AuthModule
})
export class UsersModule {}
