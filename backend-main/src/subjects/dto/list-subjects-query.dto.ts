import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListSubjectsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
