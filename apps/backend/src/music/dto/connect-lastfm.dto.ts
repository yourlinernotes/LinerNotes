import { IsString, IsNotEmpty } from 'class-validator';

export class ConnectLastFmDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
