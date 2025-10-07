import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Permission } from './permission.entity';
import { Role } from './role.entity';

@Entity('role_permissions')
@Index(['roleId', 'permissionId'], { unique: true })
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roleId: string;

  @ManyToOne(
    () => Role,
    (role) => role.rolePermissions,
    {
      onDelete: 'CASCADE',
    }
  )
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column()
  permissionId: string;

  @ManyToOne(
    () => Permission,
    (permission) => permission.rolePermissions,
    {
      onDelete: 'CASCADE',
    }
  )
  @JoinColumn({ name: 'permissionId' })
  permission: Permission;

  @Column({ type: 'simple-json', nullable: true })
  conditions: {
    organizationScope?: 'own' | 'children' | 'all';
    resourceScope?: string[];
    customConditions?: Record<string, any>;
  };

  @CreateDateColumn()
  createdAt: Date;
}
