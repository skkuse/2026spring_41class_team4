import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { UserMeDto } from './dto/user-me.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async findByIdOrThrow(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByEmailAndName(email: string, name: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email, name } });
  }

  async createOAuthUser(input: {
    email: string;
    name: string;
    profileImageUrl?: string | null;
  }): Promise<User> {
    const user = this.userRepository.create({
      email: input.email,
      name: input.name,
      profileImageUrl: input.profileImageUrl ?? null,
    });
    return this.userRepository.save(user);
  }

  async getMe(userId: string): Promise<UserMeDto> {
    const user = await this.findByIdOrThrow(userId);
    return this.toUserMeDto(user);
  }

  async updateMyName(userId: string, name: string): Promise<UserMeDto> {
    const user = await this.findByIdOrThrow(userId);
    user.name = name;
    const saved = await this.userRepository.save(user);
    return this.toUserMeDto(saved);
  }

  async incrementTokenVersion(userId: string): Promise<User> {
    const user = await this.findByIdOrThrow(userId);
    user.tokenVersion += 1;
    return this.userRepository.save(user);
  }

  private toUserMeDto(user: User): UserMeDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      profileImageUrl: user.profileImageUrl ?? null,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
