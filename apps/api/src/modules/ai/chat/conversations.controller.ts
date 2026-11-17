import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createConversationRequestSchema,
  listConversationsQuerySchema,
  sendMessageRequestSchema,
  type Conversation,
  type ConversationDetailResponse,
  type CreateConversationRequest,
  type ListConversationsQuery,
  type PaginatedConversationsResponse,
  type SendMessageRequest,
  type SendMessageResponse,
} from '@smartstudy/shared';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../core/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../core/common/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../../../core/common/pipes/zod-validation.pipe.js';
import { ConversationsService } from './conversations.service.js';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createConversationRequestSchema))
    body: CreateConversationRequest,
  ): Promise<Conversation> {
    return this.conversationsService.createConversation(user.userId, body);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listConversations(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(listConversationsQuerySchema))
    query: ListConversationsQuery,
  ): Promise<PaginatedConversationsResponse> {
    return this.conversationsService.listConversations(user.userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ConversationDetailResponse> {
    return this.conversationsService.getConversation(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.conversationsService.deleteConversation(user.userId, id);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(sendMessageRequestSchema))
    body: SendMessageRequest,
  ): Promise<SendMessageResponse> {
    return this.conversationsService.sendMessage(user.userId, id, body);
  }
}
