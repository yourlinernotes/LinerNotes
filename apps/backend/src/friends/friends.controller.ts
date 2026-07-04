import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { SendRequestDto } from './dto/send-request.dto';
import { RespondRequestDto } from './dto/respond-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post('request')
  async sendRequest(@Request() req, @Body() sendRequestDto: SendRequestDto) {
    // Extract userId from authenticated request (req.user.id from JWT)
    const userId = req.user.id;
    return this.friendsService.sendRequest(userId, sendRequestDto.addresseeId);
  }

  @Patch(':friendshipId')
  async respondToRequest(
    @Request() req,
    @Param('friendshipId') friendshipId: string,
    @Body() respondRequestDto: RespondRequestDto,
  ) {
    const userId = req.user.id;
    return this.friendsService.respondToRequest(
      friendshipId,
      userId,
      respondRequestDto.accept,
    );
  }

  @Get()
  async getFriends(@Request() req) {
    const userId = req.user.id;
    return this.friendsService.getFriends(userId);
  }

  @Get('pending')
  async getPendingRequests(@Request() req) {
    const userId = req.user.id;
    return this.friendsService.getPendingRequests(userId);
  }

  @Delete(':friendshipId')
  async removeFriend(@Request() req, @Param('friendshipId') friendshipId: string) {
    const userId = req.user.id;
    return this.friendsService.removeFriend(friendshipId, userId);
  }
}
