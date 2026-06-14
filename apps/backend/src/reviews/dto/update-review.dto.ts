import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsEnum,
} from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(5.0)
  rating?: number;

  @IsOptional()
  @IsString()
  take?: string;

  @IsOptional()
  @IsEnum(['flame', 'love', 'skip'])
  reaction?: 'flame' | 'love' | 'skip' | null;

  @IsOptional()
  @IsString()
  featuredNoteId?: string;
}
