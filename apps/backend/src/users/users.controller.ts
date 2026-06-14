import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':handle')
  async getUserByHandle(@Param('handle') handle: string) {
    return this.usersService.findByHandle(handle);
  }

  // Protected route - requires JWT guard (to be implemented)
  // @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateCurrentUser(
    @Request() req: any, // Replace with proper Request type with user
    @Body() updateUserDto: UpdateUserDto,
  ) {
    // Assuming req.user.id is populated by JWT guard
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.usersService.update(userId, updateUserDto);
  }
}
