import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class SubmitAnswerDto {
  @IsUUID('4')
  quizProblemId: string;

  @IsOptional()
  @IsString()
  userAnswer?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selectedChoiceIds?: string[];

  @IsBoolean()
  usedHint: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  hintLevelUsed?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  elapsedSeconds?: number | null;
}
