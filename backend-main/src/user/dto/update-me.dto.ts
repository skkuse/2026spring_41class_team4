import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
