import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';
import { User } from './user.entity';

@Entity('user_roles')
@Index(['userId', 'roleId'], { unique: true })
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(
    () => User,
    (user) => user.userRoles,
    {
      onDelete: 'CASCADE',
    }
  )
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  roleId: string;

  @ManyToOne(
    () => Role,
    (role) => role.userRoles,
    {
      onDelete: 'CASCADE',
    }
  )
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ nullable: true })
  grantedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Check if role assignment is expired
  isExpired(): boolean {
    return this.expiresAt && this.expiresAt < new Date();
  }
}
