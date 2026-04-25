import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('time_off_request')
@Index(['employeeId', 'locationId'])
export class TimeOffRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  employeeId: string;

  @Column({ type: 'varchar' })
  locationId: string;

  @Column({ type: 'varchar' })
  leaveType: string;

  @Column({ type: 'float' })
  days: number;

  @Column({
    type: 'varchar',
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column({ type: 'varchar', nullable: true })
  hcmRef: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
