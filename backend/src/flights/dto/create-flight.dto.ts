import { IsString, IsOptional, IsUUID, IsDateString, MaxLength, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFlightDto {
  @IsDateString()
  flight_date: string;

  @IsOptional()
  @IsUUID()
  site_id?: string;

  @IsOptional()
  @IsUUID()
  pilot_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  launch_site_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  glider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  harness?: string;

  /** The flightnow Flight.id — used to link this upload to a logbook entry. */
  @IsOptional()
  @IsUUID()
  client_id?: string;

  // @Type coercion: this DTO arrives as multipart/form-data, where every
  // field is a string — without it @IsNumber() rejects the request with 400.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  takeoff_lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  takeoff_lon?: number;
}
