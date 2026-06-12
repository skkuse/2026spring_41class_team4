import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateMockExamDto {
  @IsInt()
  @Min(1)
  @Max(50)
  quizProblemCount: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  documentIds?: string[];

  @IsOptional()
  @IsBoolean()
  targetWeakKeywords?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  keywordIds?: string[];
}
