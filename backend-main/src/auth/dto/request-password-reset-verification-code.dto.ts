import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RequestPasswordResetVerificationCodeDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
