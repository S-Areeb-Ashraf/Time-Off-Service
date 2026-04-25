import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';

const VALID_LEAVE_TYPES = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY'];

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'employeeId is required' })
  employeeId: string;

  @IsString()
  @IsNotEmpty({ message: 'locationId is required' })
  locationId: string;

  @IsString()
  @IsIn(VALID_LEAVE_TYPES, {
    message: `leaveType must be one of: ${VALID_LEAVE_TYPES.join(', ')}`,
  })
  leaveType: string;

  @IsNumber({}, { message: 'days must be a number' })
  @Min(0.5, { message: 'days must be at least 0.5' })
  days: number;
}
