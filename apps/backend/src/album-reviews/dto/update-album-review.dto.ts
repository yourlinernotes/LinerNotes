import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class UpdateAlbumReviewDto {
  @IsNumber()
  @IsOptional()
  @Min(0.5)
  @Max(5.0)
  overallRating?: number;

  @IsString()
  @IsOptional()
  take?: string;
}
