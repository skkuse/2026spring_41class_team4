import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestRegisterVerificationCodeDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
