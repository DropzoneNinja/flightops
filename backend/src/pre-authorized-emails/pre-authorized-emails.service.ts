import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreAuthorizedEmail } from '../database/entities/pre-authorized-email.entity';
import { CreatePreAuthorizedEmailDto, UpdatePreAuthorizedEmailDto } from './dto';

@Injectable()
export class PreAuthorizedEmailsService {
  constructor(
    @InjectRepository(PreAuthorizedEmail)
    private readonly preAuthEmailRepository: Repository<PreAuthorizedEmail>,
  ) {}

  /**
   * Create a new pre-authorized email
   */
  async create(
    email: string,
    addedByUserId: string,
    notes?: string,
  ): Promise<PreAuthorizedEmail> {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already pre-authorized');
    }

    const preAuthEmail = this.preAuthEmailRepository.create({
      email: email.toLowerCase().trim(),
      added_by_user_id: addedByUserId,
      notes,
    });

    return this.preAuthEmailRepository.save(preAuthEmail);
  }

  /**
   * Find all pre-authorized emails
   */
  async findAll(): Promise<PreAuthorizedEmail[]> {
    return this.preAuthEmailRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find pre-authorized email by email address
   */
  async findByEmail(email: string): Promise<PreAuthorizedEmail | null> {
    return this.preAuthEmailRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * Check if email is pre-authorized and not yet used
   */
  async isEmailAuthorized(email: string): Promise<boolean> {
    const preAuthEmail = await this.findByEmail(email);
    return preAuthEmail !== null && !preAuthEmail.used;
  }

  /**
   * Mark email as used
   */
  async markAsUsed(email: string): Promise<void> {
    const preAuthEmail = await this.findByEmail(email);
    if (preAuthEmail) {
      preAuthEmail.used = true;
      await this.preAuthEmailRepository.save(preAuthEmail);
    }
  }

  /**
   * Delete a pre-authorized email
   */
  async delete(id: string): Promise<void> {
    const result = await this.preAuthEmailRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Pre-authorized email not found');
    }
  }

  /**
   * Update pre-authorized email notes
   */
  async update(
    id: string,
    updateDto: UpdatePreAuthorizedEmailDto,
  ): Promise<PreAuthorizedEmail> {
    const preAuthEmail = await this.preAuthEmailRepository.findOne({
      where: { id },
    });

    if (!preAuthEmail) {
      throw new NotFoundException('Pre-authorized email not found');
    }

    Object.assign(preAuthEmail, updateDto);
    return this.preAuthEmailRepository.save(preAuthEmail);
  }
}
