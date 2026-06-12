import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AuthVerificationCode } from '../auth/entities/auth-verification-code.entity';
import { MasteryScore } from '../mastery/entities/mastery-score.entity';
import { OauthAccount } from '../auth/entities/oauth-account.entity';
import { PasswordCredential } from '../auth/entities/password-credential.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';

@Entity('users')
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'profile_image_url', type: 'varchar', length: 500, nullable: true })
  profileImageUrl?: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion: number;

  @Column({ name: 'email_verified_at', type: 'timestamp', nullable: true })
  emailVerifiedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => OauthAccount, (oauthAccount) => oauthAccount.user)
  oauthAccounts: OauthAccount[];

  @OneToMany(() => Subject, (subject) => subject.user)
  subjects: Subject[];

  @OneToOne(
    () => PasswordCredential,
    (passwordCredential) => passwordCredential.user,
  )
  passwordCredential?: PasswordCredential | null;

  @OneToMany(
    () => AuthVerificationCode,
    (authVerificationCode) => authVerificationCode.user,
  )
  authVerificationCodes: AuthVerificationCode[];

  @OneToMany(() => MasteryScore, (masteryScore) => masteryScore.user)
  masteryScores: MasteryScore[];
}
