import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginAttemptService } from './login-attempt.service';
import { MediaTokenService } from './media-token.service';
import { UsersModule } from '../users/users.module';
import { PreAuthorizedEmailsModule } from '../pre-authorized-emails/pre-authorized-emails.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { LoginAttempt } from '../database/entities/login-attempt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoginAttempt]),
    UsersModule,
    PreAuthorizedEmailsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LoginAttemptService, MediaTokenService, JwtStrategy, LocalStrategy],
  exports: [AuthService, MediaTokenService],
})
export class AuthModule {}
