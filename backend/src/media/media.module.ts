import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { Media } from '../database/entities/media.entity';
import { AuthModule } from '../auth/auth.module';
import { MediaTokenGuard } from '../auth/guards/media-token.guard';
import { UsersModule } from '../users/users.module';
import { FlightsModule } from '../flights/flights.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Media]),
    AuthModule, // Import AuthModule to use MediaTokenService
    UsersModule, // Import UsersModule to use UsersService for storage tracking
    FlightsModule, // Import FlightsModule for read-only flight summaries on media detail
  ],
  controllers: [MediaController],
  providers: [MediaService, MediaTokenGuard],
  exports: [MediaService],
})
export class MediaModule {}
