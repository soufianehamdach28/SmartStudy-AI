import { errorCodes, pick } from '@react-native-documents/picker';
import { MAX_DOCUMENT_SIZE_BYTES } from '@smartstudy/shared';
import { pickCourseDocument } from './document-picker';

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: {
    pdf: 'application/pdf',
    plainText: 'text/plain',
  },
  errorCodes: {
    OPERATION_CANCELED: 'OPERATION_CANCELED',
  },
  isErrorWithCode: (err: any) => Boolean(err && typeof err === 'object' && 'code' in err),
}));

describe('pickCourseDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns picked file information for a valid PDF', async () => {
    (pick as jest.Mock).mockResolvedValueOnce([
      {
        uri: 'content://com.android.providers.downloads/1',
        name: 'biology-notes.pdf',
        type: 'application/pdf',
        size: 1024 * 500,
      },
    ]);

    const result = await pickCourseDocument();

    expect(result).toEqual({
      uri: 'content://com.android.providers.downloads/1',
      name: 'biology-notes.pdf',
      type: 'application/pdf',
      size: 1024 * 500,
    });
  });

  it('returns null when user cancels picker', async () => {
    const cancelError = new Error('User canceled');
    (cancelError as any).code = errorCodes.OPERATION_CANCELED;

    (pick as jest.Mock).mockRejectedValueOnce(cancelError);

    const result = await pickCourseDocument();

    expect(result).toBeNull();
  });

  it('throws error when file exceeds 10 MB limit', async () => {
    (pick as jest.Mock).mockResolvedValueOnce([
      {
        uri: 'content://file',
        name: 'huge-file.pdf',
        type: 'application/pdf',
        size: MAX_DOCUMENT_SIZE_BYTES + 1024,
      },
    ]);

    await expect(pickCourseDocument()).rejects.toThrow(
      'The selected file exceeds the maximum allowed size of 10 MB.',
    );
  });

  it('throws error when file has unsupported extension', async () => {
    (pick as jest.Mock).mockResolvedValueOnce([
      {
        uri: 'content://file',
        name: 'document.docx',
        type: 'application/msword',
        size: 1024,
      },
    ]);

    await expect(pickCourseDocument()).rejects.toThrow(
      'Please select a valid PDF (.pdf) or text (.txt) file.',
    );
  });
});
