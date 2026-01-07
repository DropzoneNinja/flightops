import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PreAuthorizedEmailsService } from './pre-authorized-emails.service';
import { CreatePreAuthorizedEmailDto, UpdatePreAuthorizedEmailDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';

@Controller('pre-authorized-emails')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PreAuthorizedEmailsController {
  constructor(
    private readonly preAuthEmailsService: PreAuthorizedEmailsService,
  ) {}

  /**
   * GET /pre-authorized-emails
   * Get all pre-authorized emails
   */
  @Get()
  findAll() {
    return this.preAuthEmailsService.findAll();
  }

  /**
   * POST /pre-authorized-emails
   * Add a new pre-authorized email
   */
  @Post()
  create(
    @CurrentUser() user: User,
    @Body() createDto: CreatePreAuthorizedEmailDto,
  ) {
    return this.preAuthEmailsService.create(
      createDto.email,
      user.id,
      createDto.notes,
    );
  }

  /**
   * PUT /pre-authorized-emails/:id
   * Update pre-authorized email
   */
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePreAuthorizedEmailDto,
  ) {
    return this.preAuthEmailsService.update(id, updateDto);
  }

  /**
   * DELETE /pre-authorized-emails/:id
   * Delete a pre-authorized email
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.preAuthEmailsService.delete(id);
    return { message: 'Pre-authorized email deleted successfully' };
  }
}
