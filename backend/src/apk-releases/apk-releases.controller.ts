import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Req,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import * as fs from 'fs';
import { createReadStream, statSync } from 'fs';
import { ApkReleasesService } from './apk-releases.service';
import { CreateApkReleaseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApkTokenGuard } from '../auth/guards/apk-token.guard';
import { ApkTokenService } from '../auth/apk-token.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { UsersService } from '../users/users.service';

const MAX_APK_SIZE = 300 * 1024 * 1024; // 300MB

@Controller('apk-releases')
export class ApkReleasesController {
  constructor(
    private readonly apkReleasesService: ApkReleasesService,
    private readonly apkTokenService: ApkTokenService,
    private readonly usersService: UsersService,
  ) {}

  private async assertHasAccess(user: User): Promise<void> {
    if (user.is_admin) return;
    const hasAccess = await this.usersService.hasApkAccess(user.id);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to Flightoid app releases');
    }
  }

  /**
   * GET /apk-releases
   * List APK releases (newest first) for admins or explicitly-authorized users
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@CurrentUser() user: User) {
    await this.assertHasAccess(user);
    return this.apkReleasesService.findAll();
  }

  /**
   * GET /apk-releases/access
   * List every user together with their current access flag (admin only)
   */
  @Get('access')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAccess() {
    const users = await this.usersService.findAll();
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      is_admin: u.is_admin,
      has_apk_access: u.has_apk_access,
    }));
  }

  /**
   * POST /apk-releases/access/:userId
   * Grant a user access to the Flightoid APK page (admin only)
   */
  @Post('access/:userId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async grantAccess(@Param('userId') userId: string, @CurrentUser() user: User) {
    await this.usersService.grantApkAccess(userId, user.id);
    return { message: 'Access granted' };
  }

  /**
   * DELETE /apk-releases/access/:userId
   * Revoke a user's access to the Flightoid APK page (admin only)
   */
  @Delete('access/:userId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async revokeAccess(@Param('userId') userId: string) {
    await this.usersService.revokeApkAccess(userId);
    return { message: 'Access revoked' };
  }

  /**
   * GET /apk-releases/:id/token
   * Short-lived, release-specific download token (5 minutes)
   * IMPORTANT: This route must be defined BEFORE the generic :id route (none exists here, but kept for consistency)
   */
  @Get(':id/token')
  @UseGuards(JwtAuthGuard)
  async getDownloadToken(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ token: string; expiresIn: string; releaseId: string }> {
    await this.assertHasAccess(user);
    await this.apkReleasesService.findById(id);

    const token = this.apkTokenService.generateApkToken(id, user.id);
    return { token, expiresIn: '5m', releaseId: id };
  }

  /**
   * GET /apk-releases/:id/file
   * Streams the APK file. Requires a token obtained from GET /apk-releases/:id/token
   */
  @Get(':id/file')
  @UseGuards(ApkTokenGuard)
  async getFile(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const release = await this.apkReleasesService.findById(id);
    const filePath = this.apkReleasesService.getFullFilePath(release);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('APK file not found on disk');
    }

    const stat = statSync(filePath);
    res.set({
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${release.original_filename}"`,
      'Content-Length': stat.size.toString(),
    });

    createReadStream(filePath).pipe(res);
  }

  /**
   * POST /apk-releases
   * Upload a new APK release (admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_APK_SIZE },
      fileFilter: (req, file, callback) => {
        if (!file.originalname.toLowerCase().endsWith('.apk')) {
          return callback(new BadRequestException('Only .apk files are allowed'), false);
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateApkReleaseDto,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.apkReleasesService.uploadRelease(file, dto, user.username);
  }

  /**
   * DELETE /apk-releases/:id
   * Delete an APK release (admin only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    await this.apkReleasesService.deleteRelease(id);
    return { message: 'APK release deleted successfully' };
  }
}
