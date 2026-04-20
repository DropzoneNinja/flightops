import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class ReorderWaypointsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  waypoint_ids: string[];
}
