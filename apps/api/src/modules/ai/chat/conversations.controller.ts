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
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('Chat & Conversations')
@ApiBearerAuth('JWT-auth')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a new conversation thread for a course document',
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully.',
  })
  @ApiResponse({ status: 400, description: 'Document not ready.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async createConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createConversationRequestSchema))
    body: CreateConversationRequest,
  ): Promise<Conversation> {
    return this.conversationsService.createConversation(user.userId, body);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List user conversations, optionally filtered by documentId',
  })
  @ApiQuery({
    name: 'documentId',
    required: false,
    type: String,
    description: 'Filter conversations by document UUID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (1-100, default 20)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor ID for next page',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of conversations.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  async listConversations(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(listConversationsQuerySchema))
    query: ListConversationsQuery,
  ): Promise<PaginatedConversationsResponse> {
    return this.conversationsService.listConversations(user.userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve conversation thread with all past messages and citations',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Conversation UUID' })
  @ApiResponse({
    status: 200,
    description: 'Conversation details and message history.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async getConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ConversationDetailResponse> {
    return this.conversationsService.getConversation(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete conversation thread and all its messages',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Conversation UUID' })
  @ApiResponse({
    status: 204,
    description: 'Conversation deleted successfully.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async deleteConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.conversationsService.deleteConversation(user.userId, id);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ask a question in a conversation; retrieves chunks and returns answer with citations',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Conversation UUID' })
  @ApiResponse({
    status: 201,
    description: 'Grounded assistant response with verifiable citations.',
  })
  @ApiResponse({ status: 400, description: 'Validation failed or document not ready.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  @ApiResponse({ status: 429, description: 'AI quota or rate limit exceeded.' })
  async sendMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(sendMessageRequestSchema))
    body: SendMessageRequest,
  ): Promise<SendMessageResponse> {
    return this.conversationsService.sendMessage(user.userId, id, body);
  }
}
