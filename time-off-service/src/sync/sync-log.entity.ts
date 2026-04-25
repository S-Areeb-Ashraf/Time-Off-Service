import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SyncTrigger {
  BATCH = 'BATCH',
  REALTIME = 'REALTIME',
  MANUAL = 'MANUAL',
}

@Entity('sync_log')
@Index(['employeeId', 'locationId'])
@Index(['timestamp'])
export class SyncLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  employeeId: string;

  @Column({ type: 'varchar' })
  locationId: string;

  @Column({ type: 'varchar' })
  leaveType: string;

  @Column({ type: 'varchar' })
  trigger: SyncTrigger;

  @Column({ type: 'float', default: 0 })
  delta: number;

  @Column({ type: 'float', default: 0 })
  previousBalance: number;

  @Column({ type: 'float', default: 0 })
  newBalance: number;

  @CreateDateColumn()
  timestamp: Date;
}
