import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsIn,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

const VALID_LEAVE_TYPES = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY'];

export class BatchRecordDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsString()
  @IsIn(VALID_LEAVE_TYPES, {
    message: `leaveType must be one of: ${VALID_LEAVE_TYPES.join(', ')}`,
  })
  leaveType: string;

  @IsNumber()
  @Min(0)
  balance: number;
}

export class BatchSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchRecordDto)
  records: BatchRecordDto[];
}

export class RealtimeSyncDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  locationId: string;
}
