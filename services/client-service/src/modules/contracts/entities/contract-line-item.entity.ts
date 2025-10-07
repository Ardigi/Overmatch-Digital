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
import { Contract } from './contract.entity';

export enum LineItemType {
  SERVICE = 'service',
  PRODUCT = 'product',
  DISCOUNT = 'discount',
  TAX = 'tax',
  FEE = 'fee',
  CREDIT = 'credit',
}

export enum LineItemBillingCycle {
  ONE_TIME = 'one_time',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUAL = 'semi_annual',
  ANNUAL = 'annual',
  USAGE_BASED = 'usage_based',
}

@Entity('contract_line_items')
@Index(['contractId'])
export class ContractLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contractId: string;

  @ManyToOne(
    () => Contract,
    (contract) => contract.lineItems,
    {
      onDelete: 'CASCADE',
    }
  )
  @JoinColumn({ name: 'contractId' })
  contract: Contract;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: LineItemType,
    default: LineItemType.SERVICE,
  })
  type: LineItemType;

  @Column({ nullable: true })
  sku: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity: number;

  @Column({ default: 'units' })
  unitOfMeasure: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalPrice: number;

  @Column({
    type: 'enum',
    enum: LineItemBillingCycle,
    default: LineItemBillingCycle.MONTHLY,
  })
  billingCycle: LineItemBillingCycle;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ default: true })
  isRecurring: boolean;

  @Column({ default: true })
  isTaxable: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  taxRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discountPercentage: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  discountAmount: number;

  @Column({ nullable: true })
  discountReason: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    category?: string;
    department?: string;
    projectId?: string;
    costCenter?: string;
    glCode?: string;
    customFields?: Record<string, any>;
  };

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  // Helper methods
  calculateSubtotal(): number {
    return Number(this.quantity) * Number(this.unitPrice);
  }

  calculateDiscount(): number {
    if (this.discountAmount) return Number(this.discountAmount);
    if (this.discountPercentage) {
      return this.calculateSubtotal() * (Number(this.discountPercentage) / 100);
    }
    return 0;
  }

  calculateTax(): number {
    if (!this.isTaxable) return 0;
    if (this.taxAmount) return Number(this.taxAmount);
    if (this.taxRate) {
      const subtotal = this.calculateSubtotal() - this.calculateDiscount();
      return subtotal * (Number(this.taxRate) / 100);
    }
    return 0;
  }

  calculateTotal(): number {
    const subtotal = this.calculateSubtotal();
    const discount = this.calculateDiscount();
    const tax = this.calculateTax();
    return subtotal - discount + tax;
  }

  getMonthlyValue(): number {
    const total = this.calculateTotal();
    switch (this.billingCycle) {
      case LineItemBillingCycle.ONE_TIME:
        return 0;
      case LineItemBillingCycle.MONTHLY:
        return total;
      case LineItemBillingCycle.QUARTERLY:
        return total / 3;
      case LineItemBillingCycle.SEMI_ANNUAL:
        return total / 6;
      case LineItemBillingCycle.ANNUAL:
        return total / 12;
      default:
        return 0;
    }
  }
}
