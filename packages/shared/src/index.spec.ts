import { describe, expect, it } from 'vitest';
import {
  authResponseSchema,
  citationSchema,
  conversationDetailResponseSchema,
  conversationSchema,
  createConversationRequestSchema,
  documentChunkSchema,
  documentExtensionSchema,
  documentListQuerySchema,
  documentMimeTypeSchema,
  documentResponseSchema,
  documentSummaryResponseSchema,
  documentUploadResponseSchema,
  flashcardSchema,
  flashcardsResponseSchema,
  generateFlashcardsRequestSchema,
  generateQuizRequestSchema,
  listConversationsQuerySchema,
  llmChatOutputSchema,
  llmFlashcardsOutputSchema,
  llmQuizOutputSchema,
  llmSummaryOutputSchema,
  loginRequestSchema,
  messageRoleSchema,
  messageSchema,
  paginatedConversationsResponseSchema,
  paginatedDocumentsResponseSchema,
  quizAttemptResponseSchema,
  quizQuestionSchema,
  quizResponseSchema,
  refreshTokenRequestSchema,
  registerRequestSchema,
  sendMessageRequestSchema,
  sendMessageResponseSchema,
  submitQuizAttemptRequestSchema,
  usageKindSchema,
  usageQuotaResponseSchema,
  userProfileSchema,
} from './index.js';

describe('auth schemas', () => {
  it('validates a valid register request and normalizes email', () => {
    const parsed = registerRequestSchema.parse({
      email: '  STUDENT@ExamPle.Com ',
      password: 'strong-password-123',
    });

    expect(parsed.email).toBe('student@example.com');
    expect(parsed.password).toBe('strong-password-123');
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = registerRequestSchema.safeParse({
      email: 'student@example.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid emails', () => {
    const result = registerRequestSchema.safeParse({
      email: 'not-an-email',
      password: 'strong-password-123',
    });

    expect(result.success).toBe(false);
  });

  it('validates a valid login request', () => {
    const parsed = loginRequestSchema.parse({
      email: ' Student@Example.com ',
      password: 'any-password',
    });

    expect(parsed.email).toBe('student@example.com');
  });

  it('validates a refresh token request', () => {
    const parsed = refreshTokenRequestSchema.parse({
      refreshToken: 'sample-refresh-token',
    });

    expect(parsed.refreshToken).toBe('sample-refresh-token');
  });

  it('validates a user profile with valid uuid and datetime', () => {
    const profile = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'student@example.com',
      role: 'STUDENT',
      createdAt: new Date().toISOString(),
    };

    const parsed = userProfileSchema.parse(profile);
    expect(parsed.role).toBe('STUDENT');
  });

  it('validates an auth response payload', () => {
    const response = {
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      },
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'student@example.com',
        role: 'STUDENT',
        createdAt: new Date().toISOString(),
      },
    };

    const parsed = authResponseSchema.parse(response);
    expect(parsed.tokens.tokenType).toBe('Bearer');
    expect(parsed.tokens.expiresIn).toBe(900);
  });
});

describe('document schemas', () => {
  const validDoc = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Intro to Computer Science',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 500,
    status: 'UPLOADED' as const,
    errorMessage: null,
    pageCount: 12,
    summary: null,
    createdAt: new Date().toISOString(),
  };

  it('validates a valid document response', () => {
    const parsed = documentResponseSchema.parse(validDoc);
    expect(parsed.id).toBe(validDoc.id);
    expect(parsed.status).toBe('UPLOADED');
    expect(parsed.pageCount).toBe(12);
  });

  it('rejects an invalid document status', () => {
    const result = documentResponseSchema.safeParse({
      ...validDoc,
      status: 'NOT_A_REAL_STATUS',
    });
    expect(result.success).toBe(false);
  });

  it('validates document upload response (202 Accepted)', () => {
    const uploadRes = {
      document: validDoc,
      message: 'Document uploaded successfully and queued for ingestion',
    };
    const parsed = documentUploadResponseSchema.parse(uploadRes);
    expect(parsed.document.title).toBe(validDoc.title);
  });

  it('validates documentListQuerySchema and applies default page and limit', () => {
    const parsed = documentListQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(10);
  });

  it('coerces string query parameters to numbers', () => {
    const parsed = documentListQuerySchema.parse({ page: '2', limit: '25' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
  });

  it('rejects query limits over 50', () => {
    const result = documentListQuerySchema.safeParse({ limit: 51 });
    expect(result.success).toBe(false);
  });

  it('validates paginated documents response', () => {
    const paginated = {
      items: [validDoc],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
    const parsed = paginatedDocumentsResponseSchema.parse(paginated);
    expect(parsed.items.length).toBe(1);
    expect(parsed.total).toBe(1);
  });

  it('validates allowed document mime types and rejects unsupported ones', () => {
    expect(documentMimeTypeSchema.safeParse('application/pdf').success).toBe(true);
    expect(documentMimeTypeSchema.safeParse('text/plain').success).toBe(true);
    expect(documentMimeTypeSchema.safeParse('image/png').success).toBe(false);
    expect(documentMimeTypeSchema.safeParse('application/msword').success).toBe(false);
  });

  it('validates allowed document extensions', () => {
    expect(documentExtensionSchema.safeParse('.pdf').success).toBe(true);
    expect(documentExtensionSchema.safeParse('.txt').success).toBe(true);
    expect(documentExtensionSchema.safeParse('.docx').success).toBe(false);
  });

  it('validates a document chunk schema', () => {
    const chunk = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      documentId: '223e4567-e89b-12d3-a456-426614174001',
      index: 0,
      page: 1,
      text: 'First chunk of course document text',
      charStart: 0,
      charEnd: 35,
    };
    const parsed = documentChunkSchema.parse(chunk);
    expect(parsed.index).toBe(0);
    expect(parsed.page).toBe(1);
    expect(parsed.charStart).toBe(0);
    expect(parsed.charEnd).toBe(35);
  });
});

describe('AI learning schemas', () => {
  const docId = '123e4567-e89b-12d3-a456-426614174000';
  const quizId = '223e4567-e89b-12d3-a456-426614174001';
  const questionId = '323e4567-e89b-12d3-a456-426614174002';
  const userId = '423e4567-e89b-12d3-a456-426614174003';
  const chunkId = '523e4567-e89b-12d3-a456-426614174004';

  it('validates LLM summary output and document summary response', () => {
    const llmSummary = llmSummaryOutputSchema.parse({
      summary: '# Overview\nThis chapter covers thermodynamics.',
      keyTakeaways: ['First law conserves energy', 'Entropy increases'],
    });
    expect(llmSummary.keyTakeaways).toHaveLength(2);

    const apiSummary = documentSummaryResponseSchema.parse({
      documentId: docId,
      summary: llmSummary.summary,
      cached: false,
    });
    expect(apiSummary.cached).toBe(false);

    expect(
      llmSummaryOutputSchema.safeParse({ summary: 'Text', keyTakeaways: [] }).success,
    ).toBe(false);
  });

  it('validates flashcard request defaults, bounds, LLM output and response', () => {
    const defaultReq = generateFlashcardsRequestSchema.parse({});
    expect(defaultReq.count).toBe(10);

    const coercedReq = generateFlashcardsRequestSchema.parse({ count: '15' });
    expect(coercedReq.count).toBe(15);

    expect(generateFlashcardsRequestSchema.safeParse({ count: 0 }).success).toBe(false);
    expect(generateFlashcardsRequestSchema.safeParse({ count: 31 }).success).toBe(false);

    const llmOut = llmFlashcardsOutputSchema.parse({
      flashcards: [{ front: 'What is ATP?', back: 'Energy currency of cells' }],
    });
    expect(llmOut.flashcards).toHaveLength(1);

    const card = flashcardSchema.parse({
      id: '623e4567-e89b-12d3-a456-426614174005',
      documentId: docId,
      front: 'What is ATP?',
      back: 'Energy currency of cells',
    });

    const response = flashcardsResponseSchema.parse({
      documentId: docId,
      flashcards: [card],
    });
    expect(response.flashcards).toHaveLength(1);
  });

  it('validates quiz generation request defaults and bounds', () => {
    const defaultReq = generateQuizRequestSchema.parse({});
    expect(defaultReq.questionCount).toBe(5);
    expect(defaultReq.title).toBeUndefined();

    const customReq = generateQuizRequestSchema.parse({
      questionCount: '12',
      title: '  Midterm Prep  ',
    });
    expect(customReq.questionCount).toBe(12);
    expect(customReq.title).toBe('Midterm Prep');

    expect(generateQuizRequestSchema.safeParse({ questionCount: 0 }).success).toBe(false);
    expect(generateQuizRequestSchema.safeParse({ questionCount: 21 }).success).toBe(false);
  });

  it('validates LLM quiz output and enforces 4 options and correctIndex 0-3', () => {
    const validQuestion = {
      prompt: 'Which organelle produces ATP?',
      options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'],
      correctIndex: 1,
      explanation: 'Mitochondria are the powerhouse of the cell.',
      sourceChunkId: chunkId,
    };

    const parsed = llmQuizOutputSchema.parse({
      title: 'Cell Biology Quiz',
      questions: [validQuestion],
    });
    expect(parsed.questions[0]?.correctIndex).toBe(1);

    // Rejects wrong number of options
    expect(
      llmQuizOutputSchema.safeParse({
        title: 'Bad Quiz',
        questions: [{ ...validQuestion, options: ['A', 'B'] }],
      }).success,
    ).toBe(false);

    // Rejects out-of-range correctIndex
    expect(
      llmQuizOutputSchema.safeParse({
        title: 'Bad Quiz',
        questions: [{ ...validQuestion, correctIndex: 4 }],
      }).success,
    ).toBe(false);
  });

  it('validates full quiz response and quiz attempt request/response', () => {
    const question = quizQuestionSchema.parse({
      id: questionId,
      quizId,
      prompt: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctIndex: 1,
      explanation: 'Basic arithmetic.',
      sourceChunkId: null,
    });

    const quiz = quizResponseSchema.parse({
      id: quizId,
      documentId: docId,
      title: 'Math Basics',
      createdAt: new Date().toISOString(),
      questions: [question],
    });
    expect(quiz.questions).toHaveLength(1);

    const attemptReq = submitQuizAttemptRequestSchema.parse({
      answers: [{ questionId, selectedIndex: 1 }],
    });
    expect(attemptReq.answers[0]?.selectedIndex).toBe(1);

    expect(submitQuizAttemptRequestSchema.safeParse({ answers: [] }).success).toBe(false);
    expect(
      submitQuizAttemptRequestSchema.safeParse({
        answers: [{ questionId, selectedIndex: -1 }],
      }).success,
    ).toBe(false);

    const attemptRes = quizAttemptResponseSchema.parse({
      id: '723e4567-e89b-12d3-a456-426614174006',
      quizId,
      userId,
      score: 100,
      correctCount: 1,
      totalQuestions: 1,
      answers: [
        {
          questionId,
          selectedIndex: 1,
          correctIndex: 1,
          isCorrect: true,
          explanation: 'Basic arithmetic.',
        },
      ],
      completedAt: new Date().toISOString(),
    });
    expect(attemptRes.score).toBe(100);
  });

  it('validates usage kinds and quota response', () => {
    expect(usageKindSchema.safeParse('SUMMARY').success).toBe(true);
    expect(usageKindSchema.safeParse('FLASHCARDS').success).toBe(true);
    expect(usageKindSchema.safeParse('QUIZ').success).toBe(true);
    expect(usageKindSchema.safeParse('CHAT').success).toBe(true);
    expect(usageKindSchema.safeParse('UNKNOWN').success).toBe(false);

    const quota = usageQuotaResponseSchema.parse({
      dailyLimit: 20,
      dailyUsed: 3,
      dailyRemaining: 17,
      monthlyLimit: 300,
      monthlyUsed: 15,
      monthlyRemaining: 285,
    });
    expect(quota.dailyRemaining).toBe(17);
  });
});

describe('chat, conversation and citation schemas', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const docId = '223e4567-e89b-12d3-a456-426614174001';
  const conversationId = '323e4567-e89b-12d3-a456-426614174002';
  const messageId = '423e4567-e89b-12d3-a456-426614174003';
  const assistantMsgId = '523e4567-e89b-12d3-a456-426614174004';
  const chunkId = '623e4567-e89b-12d3-a456-426614174005';

  it('validates citationSchema and rejects invalid chunkId or page', () => {
    const valid = citationSchema.parse({
      chunkId,
      page: 4,
      excerpt: 'Newton second law states F = ma.',
    });
    expect(valid.page).toBe(4);

    expect(
      citationSchema.safeParse({ chunkId: 'not-a-uuid', page: 1, excerpt: 'x' }).success,
    ).toBe(false);
    expect(
      citationSchema.safeParse({ chunkId, page: 0, excerpt: 'x' }).success,
    ).toBe(false);
    expect(
      citationSchema.safeParse({ chunkId, page: 1, excerpt: '' }).success,
    ).toBe(false);
  });

  it('validates message roles, messageSchema, and llmChatOutputSchema defaults', () => {
    expect(messageRoleSchema.safeParse('USER').success).toBe(true);
    expect(messageRoleSchema.safeParse('ASSISTANT').success).toBe(true);
    expect(messageRoleSchema.safeParse('SYSTEM').success).toBe(false);

    const now = new Date().toISOString();
    const userMsg = messageSchema.parse({
      id: messageId,
      conversationId,
      role: 'USER',
      content: 'What is F=ma?',
      createdAt: now,
    });
    expect(userMsg.citations).toEqual([]);

    const llmOut = llmChatOutputSchema.parse({
      answer: 'Force equals mass times acceleration.',
      citations: [{ chunkId, page: 2, excerpt: 'F = m * a' }],
    });
    expect(llmOut.citations).toHaveLength(1);

    const llmDefaultCitations = llmChatOutputSchema.parse({
      answer: 'Not found in the document.',
    });
    expect(llmDefaultCitations.citations).toEqual([]);
  });

  it('validates createConversationRequestSchema, sendMessageRequestSchema, and responses', () => {
    const createReq = createConversationRequestSchema.parse({
      documentId: docId,
      title: '  Physics Chapter 2  ',
    });
    expect(createReq.title).toBe('Physics Chapter 2');

    const createNoTitle = createConversationRequestSchema.parse({ documentId: docId });
    expect(createNoTitle.title).toBeUndefined();

    const msgReq = sendMessageRequestSchema.parse({ content: '  Explain inertia  ' });
    expect(msgReq.content).toBe('Explain inertia');
    expect(sendMessageRequestSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(
      sendMessageRequestSchema.safeParse({ content: 'a'.repeat(2001) }).success,
    ).toBe(false);

    const now = new Date().toISOString();
    const conv = conversationSchema.parse({
      id: conversationId,
      userId,
      documentId: docId,
      title: 'Physics Chapter 2',
      createdAt: now,
    });

    const userMessage = {
      id: messageId,
      conversationId,
      role: 'USER' as const,
      content: 'Explain inertia',
      citations: [],
      createdAt: now,
    };
    const assistantMessage = {
      id: assistantMsgId,
      conversationId,
      role: 'ASSISTANT' as const,
      content: 'Inertia is the resistance to change in motion.',
      citations: [{ chunkId, page: 3, excerpt: 'Resistance to change in motion' }],
      createdAt: now,
    };

    const detail = conversationDetailResponseSchema.parse({
      ...conv,
      messages: [userMessage, assistantMessage],
    });
    expect(detail.messages).toHaveLength(2);

    const sendRes = sendMessageResponseSchema.parse({
      userMessage,
      assistantMessage,
    });
    expect(sendRes.assistantMessage.citations[0].page).toBe(3);

    const query = listConversationsQuerySchema.parse({});
    expect(query.page).toBe(1);
    expect(query.limit).toBe(20);

    const paginated = paginatedConversationsResponseSchema.parse({
      items: [conv],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    expect(paginated.items).toHaveLength(1);
  });
});
