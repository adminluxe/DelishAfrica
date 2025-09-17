import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { PaginationQueryDto } from '../common/pagination.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list(@Query() q: PaginationQueryDto, @Query('email') email?: string) {
    return this.service.findAll(q, email);
  }

  @Get('by-email')
  async byEmail(@Query('email') email: string) {
    const user = await this.service.findByEmail(email);
    return user ?? null;
  }
}
