import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class FindIdDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
