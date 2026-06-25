import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Readable } from 'stream';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { LogbookService } from './logbook.service';
import { LogbookPdfService } from './logbook-pdf.service';
import { CreateLogbookEntryDto } from './dto/create-logbook-entry.dto';
import { UpdateLogbookEntryDto } from './dto/update-logbook-entry.dto';
import { PushLogbookDto } from './dto/push-logbook.dto';

@Controller('logbook')
@UseGuards(JwtAuthGuard)
export class LogbookController {
  constructor(
    private readonly logbookService: LogbookService,
    private readonly pdfService: LogbookPdfService,
  ) {}

  /** GET /logbook?from=YYYY-MM-DD&to=YYYY-MM-DD */
  @Get()
  list(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.logbookService.findAll(user.id, from, to);
  }

  /** GET /logbook/sync?since=ISO */
  @Get('sync')
  syncPull(
    @CurrentUser() user: User,
    @Query('since') since?: string,
  ) {
    return this.logbookService.syncPull(user.id, since);
  }

  /** GET /logbook/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD */
  @Get('pdf')
  async downloadPdf(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const pilot = await this.logbookService.resolvePilot(user.id);
    const entries = await this.logbookService.findAll(user.id, from, to);
    const stream: Readable = this.pdfService.generate(pilot, entries);
    const slug = pilot.slug ?? pilot.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="logbook-${slug}.pdf"`,
    });
    return new StreamableFile(stream);
  }

  /** GET /logbook/orphaned-flights — flights uploaded by the user with no linked logbook entry */
  @Get('orphaned-flights')
  findOrphanedFlights(@CurrentUser() user: User) {
    return this.logbookService.findOrphanedFlights(user.id);
  }

  /** POST /logbook/orphaned-flights/:flightId/import — import a flight as a logbook entry */
  @Post('orphaned-flights/:flightId/import')
  importFlight(@CurrentUser() user: User, @Param('flightId') flightId: string) {
    return this.logbookService.importFlightToLogbook(user.id, flightId);
  }

  /** GET /logbook/:id */
  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.logbookService.findOne(user.id, id);
  }

  /** POST /logbook — manual create */
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateLogbookEntryDto) {
    return this.logbookService.create(user.id, dto);
  }

  /** POST /logbook/sync — batch push from mobile */
  @Post('sync')
  syncPush(@CurrentUser() user: User, @Body() dto: PushLogbookDto) {
    return this.logbookService.syncPush(user.id, dto.entries, dto.deletes);
  }

  /** PATCH /logbook/:id */
  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateLogbookEntryDto,
  ) {
    return this.logbookService.update(user.id, id, dto);
  }

  /** DELETE /logbook/:id — soft delete */
  @Delete(':id')
  softDelete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.logbookService.softDelete(user.id, id);
  }
}
