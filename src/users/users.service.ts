import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  // Injecting Repository Pattern for quering the database
  constructor(@InjectRepository(User) private userRepository: Repository<User>) { }

  async create(user: CreateUserDto) {
    return await this.userRepository.save(user);
  }

  async findAll() {
    let users = await this.userRepository.find();

    return users;
  }

  async findOne(id: number) {
    let user = await this.userRepository.findOne({
      where: {
        id,
      }
    });

    if (!user) throw new NotFoundException(`User with id ${id} not found`);

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    let updatedUser = await this.userRepository.update(id, updateUserDto);

    if (updatedUser.affected === 0) throw new NotFoundException(`User with id ${id} not found`);

    return await this.userRepository.findOne({ where: { id } });
  }

  async remove(id: number) {
    let deletedUser = await this.userRepository.delete(id);

    return "User deleted successfully";
  }
}
