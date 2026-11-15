import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUserPayload } from '../../core/common/decorators/current-user.decorator.js';
import type { SummaryService } from '../ai/summary.service.js';
import { DocumentsController } from './documents.controller.js';
import type { DocumentsService } from './documents.service.js';

describe('DocumentsController - summarize', () => {
  let controller: DocumentsController;
  let documentsServiceMock: Partial<DocumentsService>;
  let summaryServiceMock: {
    summarizeDocument: ReturnType<typeof vi.fn>;
  };

  const user: CurrentUserPayload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'student@example.com',
    role: 'STUDENT',
  };
  const docId = '223e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    documentsServiceMock = {};
    summaryServiceMock = {
      summarizeDocument: vi.fn(),
    };

    controller = new DocumentsController(
      documentsServiceMock as DocumentsService,
      summaryServiceMock as unknown as SummaryService,
    );
  });

  it('delegates summarize request to SummaryService', async () => {
    const expectedResponse = {
      documentId: docId,
      summary: '# Summary content',
      cached: false,
    };

    summaryServiceMock.summarizeDocument.mockResolvedValue(expectedResponse);

    const result = await controller.summarize(user, docId);

    expect(summaryServiceMock.summarizeDocument).toHaveBeenCalledWith(user.userId, docId);
    expect(result).toEqual(expectedResponse);
  });
});
