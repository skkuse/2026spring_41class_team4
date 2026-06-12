import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  verificationCode: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
