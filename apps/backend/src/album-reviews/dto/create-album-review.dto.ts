import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAlbumReviewDto {
  @IsString()
  @IsNotEmpty()
  albumId: string;

  @IsString()
  @IsNotEmpty()
  albumName: string;

  @IsString()
  @IsNotEmpty()
  albumArtist: string;

  @IsString()
  @IsNotEmpty()
  artworkUrl: string;

  @IsString()
  @IsOptional()
  releaseDate?: string;

  @IsInt()
  @IsOptional()
  totalTracks?: number;

  @IsNumber()
  @IsOptional()
  @Min(0.5)
  @Max(5.0)
  overallRating?: number;

  @IsString()
  @IsOptional()
  take?: string;
}
