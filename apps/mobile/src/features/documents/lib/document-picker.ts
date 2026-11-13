import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
import { MAX_DOCUMENT_SIZE_BYTES } from '@smartstudy/shared';

export interface PickedDocument {
  uri: string;
  name: string;
  type: string;
  size: number | null;
}

/**
 * Open native system file picker to select a single PDF or TXT course file.
 * Returns null if the user cancelled the picker dialog.
 * Throws an Error with friendly copy if selection is invalid or exceeds max size.
 */
export async function pickCourseDocument(): Promise<PickedDocument | null> {
  try {
    const [file] = await pick({
      type: [types.pdf, types.plainText],
      mode: 'import',
      allowMultiSelection: false,
    });

    if (!file) {
      return null;
    }

    // Validate size client-side if available
    if (file.size && file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new Error('The selected file exceeds the maximum allowed size of 10 MB.');
    }

    const name = file.name ?? 'document';
    const lower = name.toLowerCase();

    // Verify extension
    if (!lower.endsWith('.pdf') && !lower.endsWith('.txt')) {
      throw new Error('Please select a valid PDF (.pdf) or text (.txt) file.');
    }

    const type = file.type || (lower.endsWith('.pdf') ? 'application/pdf' : 'text/plain');

    return {
      uri: file.uri,
      name,
      type,
      size: file.size ?? null,
    };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw error;
  }
}
