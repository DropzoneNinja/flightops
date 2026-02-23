import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { Media } from '../database/entities/media.entity';
import { AuthModule } from '../auth/auth.module';
import { MediaTokenGuard } from '../auth/guards/media-token.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Media]),
    AuthModule, // Import AuthModule to use MediaTokenService
  ],
  controllers: [MediaController],
  providers: [MediaService, MediaTokenGuard],
  exports: [MediaService],
})
export class MediaModule {}
