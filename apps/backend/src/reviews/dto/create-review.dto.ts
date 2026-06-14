import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsUrl,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateNoteDto {
  @IsNumber()
  @Min(0)
  seconds: number;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateReviewDto {
  @IsString()
  trackId: string;

  @IsString()
  trackName: string;

  @IsString()
  trackArtist: string;

  @IsString()
  trackAlbum: string;

  @IsUrl()
  artworkUrl: string;

  @IsOptional()
  @IsUrl()
  previewUrl?: string;

  @IsNumber()
  @Min(0.5)
  @Max(5.0)
  rating: number;

  @IsOptional()
  @IsString()
  take?: string;

  @IsOptional()
  @IsEnum(['flame', 'love', 'skip'])
  reaction?: 'flame' | 'love' | 'skip';

  @IsOptional()
  @IsString()
  albumReviewId?: string;

  @IsOptional()
  @IsNumber()
  trackNumber?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNoteDto)
  notes?: CreateNoteDto[];

  @IsOptional()
  @IsString()
  featuredNoteId?: string;
}
