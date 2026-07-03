import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { createReadStream, statSync } from 'fs';
import { FlightsService } from './flights.service';
import { FlightAnalysisService } from './flight-analysis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';

@Controller('flights')
@UseGuards(JwtAuthGuard)
export class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly flightAnalysisService: FlightAnalysisService,
  ) {}

  /**
   * POST /flights/compare — compare multiple flights (normalized trackpoints + stats)
   * Body: { flight_ids: string[] }
   */
  @Post('compare')
  compareFlights(@Body('flight_ids') flightIds: string[], @CurrentUser() user: User) {
    return this.flightsService.compareFlights(flightIds, user.id);
  }

  /**
   * POST /flights — upload a GPX file for a flight day
   * Body: multipart/form-data — field "file" (.gpx) + CreateFlightDto fields
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: parseInt(process.env.MAX_GPX_UPLOAD_SIZE || '52428800', 10),
      },
    }),
  )
  uploadFlight(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateFlightDto,
    @CurrentUser() user: User,
  ) {
    return this.flightsService.uploadGpx(file, dto, user.id);
  }

  /**
   * GET /flights?date=YYYY-MM-DD — list all flights for a flight day
   */
  @Get()
  findByDate(@Query('date') date: string, @CurrentUser() user: User) {
    return this.flightsService.findByDate(date, user.id);
  }

  /**
   * GET /flights/:id — flight detail (owner only)
   */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.flightsService.findByIdForUser(id, user.id);
  }

  /**
   * GET /flights/:id/trackpoints — parsed trackpoint array for local sync (owner only)
   */
  @Get(':id/trackpoints')
  getTrackpoints(@Param('id') id: string, @CurrentUser() user: User) {
    return this.flightsService.getTrackpoints(id, user.id);
  }

  /**
   * GET /flights/:id/file — stream the raw GPX file (owner only)
   */
  @Get(':id/file')
  async streamFile(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: User,
  ): Promise<StreamableFile> {
    const filePath = await this.flightsService.getFilePath(id, user.id);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(filePath);
    } catch {
      throw new NotFoundException('GPX file not found on disk');
    }
    res.set({
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="flight-${id}.gpx"`,
      'Content-Length': stat.size,
    });
    return new StreamableFile(createReadStream(filePath));
  }

  /**
   * GET /flights/:id/analysis — return score + events + coaching notes
   */
  @Get(':id/analysis')
  async getAnalysis(@Param('id') id: string, @CurrentUser() user: User) {
    await this.flightsService.findByIdForUser(id, user.id);
    return this.flightAnalysisService.getAnalysis(id);
  }

  /**
   * POST /flights/:id/reanalyze — re-run analysis on an existing parsed flight
   */
  @Post(':id/reanalyze')
  async reanalyze(@Param('id') id: string, @CurrentUser() user: User) {
    const flight = await this.flightsService.findByIdForUser(id, user.id);
    // Fire-and-forget; client polls via GET /flights/:id/analysis or GET /flights/:id
    this.flightAnalysisService.analyzeFlightAsync(flight.id).catch(() => {/* logged internally */});
    return { message: 'Analysis started', flightId: flight.id };
  }

  /**
   * PATCH /flights/:id — update flight metadata
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFlightDto, @CurrentUser() user: User) {
    return this.flightsService.update(id, dto, user.id);
  }

  /**
   * DELETE /flights/:id — delete flight + file
   */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.flightsService.delete(id, user.id);
  }
}
