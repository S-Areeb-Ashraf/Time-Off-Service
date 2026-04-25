import { IsString, IsNotEmpty } from 'class-validator';

export class GetBalanceDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  locationId: string;
}
