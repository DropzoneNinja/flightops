import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ApkRelease } from '../database/entities/apk-release.entity';
import { CreateApkReleaseDto } from './dto';

// Local file header magic numbers for the ZIP format an APK is built on
// (PK\x03\x04 normal, PK\x05\x06 empty archive, PK\x07\x08 spanned archive).
const ZIP_MAGIC_BYTES = [0x50, 0x4b];
const ZIP_MAGIC_THIRD_BYTES = [0x03, 0x05, 0x07];

@Injectable()
export class ApkReleasesService {
  private readonly apkStoragePath: string;

  constructor(
    @InjectRepository(ApkRelease)
    private readonly apkReleaseRepository: Repository<ApkRelease>,
  ) {
    this.apkStoragePath = process.env.APK_STORAGE_PATH || '/app/apk-releases';
  }

  async findAll(): Promise<ApkRelease[]> {
    return this.apkReleaseRepository.find({ order: { created_at: 'DESC' } });
  }

  async findById(id: string): Promise<ApkRelease> {
    const release = await this.apkReleaseRepository.findOne({ where: { id } });
    if (!release) {
      throw new NotFoundException(`APK release with ID ${id} not found`);
    }
    return release;
  }

  async uploadRelease(
    file: Express.Multer.File,
    dto: CreateApkReleaseDto,
    uploadedBy: string,
  ): Promise<ApkRelease> {
    if (!file.originalname.toLowerCase().endsWith('.apk')) {
      throw new BadRequestException('Only .apk files are allowed');
    }

    const header = file.buffer.subarray(0, 3);
    const isZip =
      header[0] === ZIP_MAGIC_BYTES[0] &&
      header[1] === ZIP_MAGIC_BYTES[1] &&
      ZIP_MAGIC_THIRD_BYTES.includes(header[2]);
    if (!isZip) {
      throw new BadRequestException('File does not look like a valid APK');
    }

    await this.ensureStorageDirectoryExists();

    const secureFilename = `${randomUUID()}.apk`;
    const absoluteFilePath = path.join(this.apkStoragePath, secureFilename);
    await fs.writeFile(absoluteFilePath, file.buffer);

    const release = this.apkReleaseRepository.create({
      version_label: dto.version_label,
      release_notes: dto.release_notes ?? null,
      original_filename: file.originalname,
      file_path: secureFilename,
      file_size: file.size,
      uploaded_by: uploadedBy,
    });

    return this.apkReleaseRepository.save(release);
  }

  async deleteRelease(id: string): Promise<void> {
    const release = await this.findById(id);

    try {
      await fs.unlink(path.join(this.apkStoragePath, release.file_path));
    } catch (error) {
      console.error(`Failed to delete APK file: ${release.file_path}`, error);
    }

    await this.apkReleaseRepository.remove(release);
  }

  getFullFilePath(release: ApkRelease): string {
    return path.join(this.apkStoragePath, release.file_path);
  }

  private async ensureStorageDirectoryExists(): Promise<void> {
    await fs.mkdir(this.apkStoragePath, { recursive: true });
  }
}
