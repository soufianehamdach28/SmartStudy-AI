import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { DocumentsScreen } from './DocumentsScreen';
import { LoadingView } from '../../../shared/components/LoadingView';
import { EmptyView } from '../../../shared/components/EmptyView';
import { ErrorView } from '../../../shared/components/ErrorView';
import { DocumentCard } from '../components/DocumentCard';
import * as useDocumentsModule from '../hooks/useDocuments';
import * as documentPickerModule from '../lib/document-picker';
import { useAuthStore } from '../../auth/store/auth.store';

jest.mock('../hooks/useDocuments');
jest.mock('../lib/document-picker');
jest.spyOn(Alert, 'alert');

describe('DocumentsScreen', () => {
  const mockDoc = {
    id: 'doc-1',
    userId: 'user-1',
    title: 'physics-course.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 500,
    status: 'READY' as const,
    errorMessage: null,
    pageCount: 15,
    summary: null,
    createdAt: '2026-11-13T00:00:00.000Z',
    updatedAt: '2026-11-13T00:00:00.000Z',
  };

  const mockRefetch = jest.fn();
  const mockMutateAsyncUpload = jest.fn();
  const mockMutateAsyncDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useAuthStore.setState({
        user: {
          id: 'user-1',
          email: 'student@example.com',
          role: 'STUDENT',
          createdAt: '2026-11-13T00:00:00.000Z',
        },
        status: 'authenticated',
        error: null,
      });
    });

    (useDocumentsModule.useUploadDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsyncUpload,
      isPending: false,
    });

    (useDocumentsModule.useDeleteDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsyncDelete,
      isPending: false,
      variables: undefined,
    });
  });

  it('renders LoadingView when documents query is loading', () => {
    (useDocumentsModule.useDocuments as jest.Mock).mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: mockRefetch,
      isRefetching: false,
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<DocumentsScreen />);
    });

    expect(renderer.root.findAllByType(LoadingView)).toHaveLength(1);
  });

  it('renders ErrorView with retry button when query fails', () => {
    (useDocumentsModule.useDocuments as jest.Mock).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch'),
      data: undefined,
      refetch: mockRefetch,
      isRefetching: false,
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<DocumentsScreen />);
    });

    const errorViews = renderer.root.findAllByType(ErrorView);
    expect(errorViews).toHaveLength(1);
    expect(errorViews[0].props.message).toBe('Failed to fetch');

    // Test retry callback
    errorViews[0].props.onRetry();
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders EmptyView when user has no uploaded documents', () => {
    (useDocumentsModule.useDocuments as jest.Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [], total: 0 },
      refetch: mockRefetch,
      isRefetching: false,
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<DocumentsScreen />);
    });

    const emptyViews = renderer.root.findAllByType(EmptyView);
    expect(emptyViews).toHaveLength(1);
    expect(emptyViews[0].props.title).toBe('No courses yet');
  });

  it('renders document list with DocumentCards when documents are loaded', () => {
    (useDocumentsModule.useDocuments as jest.Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [mockDoc], total: 1 },
      refetch: mockRefetch,
      isRefetching: false,
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<DocumentsScreen />);
    });

    const cards = renderer.root.findAllByType(DocumentCard);
    expect(cards).toHaveLength(1);
    expect(cards[0].props.document).toEqual(mockDoc);
  });

  it('picks and uploads a document when Import button is pressed', async () => {
    (useDocumentsModule.useDocuments as jest.Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [mockDoc], total: 1 },
      refetch: mockRefetch,
      isRefetching: false,
    });

    (documentPickerModule.pickCourseDocument as jest.Mock).mockResolvedValueOnce({
      uri: 'file:///path/to/notes.pdf',
      name: 'notes.pdf',
      type: 'application/pdf',
      size: 1024,
    });
    mockMutateAsyncUpload.mockResolvedValueOnce({ document: mockDoc });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<DocumentsScreen />);
    });

    const importButton = renderer.root.findByProps({
      testID: 'header-import-button',
    });

    await act(async () => {
      await importButton.props.onPress();
    });

    expect(documentPickerModule.pickCourseDocument).toHaveBeenCalled();
    expect(mockMutateAsyncUpload).toHaveBeenCalledWith({
      file: {
        uri: 'file:///path/to/notes.pdf',
        name: 'notes.pdf',
        type: 'application/pdf',
      },
      onProgress: expect.any(Function),
    });
  });

  it('handles cancellation gracefully when user dismisses picker', async () => {
    (useDocumentsModule.useDocuments as jest.Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [], total: 0 },
      refetch: mockRefetch,
      isRefetching: false,
    });

    (documentPickerModule.pickCourseDocument as jest.Mock).mockResolvedValueOnce(null);

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<DocumentsScreen />);
    });

    const importButton = renderer.root.findByProps({
      testID: 'header-import-button',
    });

    await act(async () => {
      await importButton.props.onPress();
    });

    expect(mockMutateAsyncUpload).not.toHaveBeenCalled();
  });
});
