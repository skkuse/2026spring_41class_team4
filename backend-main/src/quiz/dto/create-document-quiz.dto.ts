import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DifficultyLevel } from '../enums/difficulty-level.enum';

export const DEFAULT_LECTURE_QUIZ_PROBLEM_COUNT = 10;

export class CreateDocumentQuizDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  quizProblemCount?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  keywordIds?: string[];

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel | null;
}

