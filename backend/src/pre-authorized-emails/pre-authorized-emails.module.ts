import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreAuthorizedEmail } from '../database/entities/pre-authorized-email.entity';
import { PreAuthorizedEmailsService } from './pre-authorized-emails.service';
import { PreAuthorizedEmailsController } from './pre-authorized-emails.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PreAuthorizedEmail])],
  providers: [PreAuthorizedEmailsService],
  controllers: [PreAuthorizedEmailsController],
  exports: [PreAuthorizedEmailsService],
})
export class PreAuthorizedEmailsModule {}
