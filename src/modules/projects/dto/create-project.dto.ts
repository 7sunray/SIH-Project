import { IsString, IsNumber, IsOptional, IsNotEmpty, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  budget: number;

  @Type(() => Number)
  @IsNumber()
  radiusMeters: number;

  @IsString()
  @IsOptional()
  schemeCode?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  sanctionedAmount?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  beneficiaryCount?: number;

  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;
}
