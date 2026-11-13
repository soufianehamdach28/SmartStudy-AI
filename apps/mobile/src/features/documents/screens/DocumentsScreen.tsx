import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyView } from '../../../shared/components/EmptyView';
import { ErrorView } from '../../../shared/components/ErrorView';
import { LoadingView } from '../../../shared/components/LoadingView';
import { useAuthStore } from '../../auth/store/auth.store';
import { parseDocumentErrorMessage } from '../api/documents.api';
import { DocumentCard } from '../components/DocumentCard';
import { UploadProgressModal } from '../components/UploadProgressModal';
import {
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
} from '../hooks/useDocuments';
import { pickCourseDocument } from '../lib/document-picker';
import type { DocumentResponse } from '@smartstudy/shared';

export function DocumentsScreen() {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useDocuments({ page: 1, limit: 50 });

  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);

  const handlePickAndUpload = async () => {
    try {
      const file = await pickCourseDocument();
      if (!file) {
        return; // User cancelled
      }

      setUploadingFileName(file.name);
      setUploadPercent(0);
      setUploadModalVisible(true);

      await uploadMutation.mutateAsync({
        file: {
          uri: file.uri,
          name: file.name,
          type: file.type,
        },
        onProgress: (pct) => {
          setUploadPercent(pct);
        },
      });

      setUploadModalVisible(false);
    } catch (err) {
      setUploadModalVisible(false);
      const friendlyMessage = parseDocumentErrorMessage(err);
      Alert.alert('Upload Failed', friendlyMessage);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteMutation.mutateAsync(docId);
    } catch (err) {
      const friendlyMessage = parseDocumentErrorMessage(err);
      Alert.alert('Delete Failed', friendlyMessage);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingView message="Loading your courses..." />;
    }

    if (isError) {
      return (
        <ErrorView
          message={parseDocumentErrorMessage(error)}
          onRetry={() => refetch()}
        />
      );
    }

    const documents = data?.items ?? [];

    if (documents.length === 0) {
      return (
        <EmptyView
          title="No courses yet"
          description="Import your first PDF or TXT course document to generate summaries, flashcards, quizzes, and chat with AI."
          actionLabel="Import Course"
          onAction={handlePickAndUpload}
        />
      );
    }

    return (
      <FlatList<DocumentResponse>
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DocumentCard
            document={item}
            onDelete={() => handleDelete(item.id)}
            isDeleting={deleteMutation.isPending && deleteMutation.variables === item.id}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
            }}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>SmartStudy</Text>
          {user?.email ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.importButton}
            onPress={handlePickAndUpload}
            activeOpacity={0.8}
            testID="header-import-button"
          >
            <Text style={styles.importButtonText}>+ Import</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={logout}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="header-signout-button"
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.content}>{renderContent()}</View>

      {/* Upload Progress Modal */}
      <UploadProgressModal
        visible={uploadModalVisible}
        fileName={uploadingFileName}
        progressPercent={uploadPercent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  importButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 10,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  signOutButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
});
