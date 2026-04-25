import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  UpdateDateColumn,
} from 'typeorm';

@Entity('time_off_balance')
@Index(['employeeId', 'locationId'])
@Index(['employeeId', 'locationId', 'leaveType'], { unique: true })
export class TimeOffBalance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  employeeId: string;

  @Column({ type: 'varchar' })
  locationId: string;

  @Column({ type: 'varchar' })
  leaveType: string;

  @Column({ type: 'float', default: 0 })
  balance: number;

  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt: Date;

  @Column({ type: 'int', default: 0 })
  version: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
