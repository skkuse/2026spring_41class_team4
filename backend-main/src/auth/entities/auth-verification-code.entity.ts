import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/user.entity';
import { AuthVerificationPurpose } from './auth-verification-purpose.enum';
import { VerificationDeliveryChannel } from './verification-delivery-channel.enum';

@Entity('auth_verification_codes')
@Index(['email', 'purpose'])
@Index(['codeHash'])
@Index(['expiresAt'])
export class AuthVerificationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({
    type: 'enum',
    enum: AuthVerificationPurpose,
    enumName: 'verification_purpose',
  })
  purpose: AuthVerificationPurpose;

  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt?: Date | null;

  @Column({ name: 'consumed_at', type: 'timestamp', nullable: true })
  consumedAt?: Date | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  @Column({
    name: 'delivery_channel',
    type: 'enum',
    enum: VerificationDeliveryChannel,
    enumName: 'verification_delivery_channel',
  })
  deliveryChannel: VerificationDeliveryChannel;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.authVerificationCodes, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;
}
