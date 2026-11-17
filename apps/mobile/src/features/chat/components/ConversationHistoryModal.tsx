import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { Conversation } from '@smartstudy/shared';
import { useFavoritesStore } from '../../../shared/store/favorites.store';
import {
  useDeleteConversation,
  useDocumentConversations,
} from '../hooks/useChat';

export interface ConversationHistoryModalProps {
  visible: boolean;
  documentId: string;
  activeConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function ConversationHistoryModal({
  visible,
  documentId,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onClose,
}: ConversationHistoryModalProps) {
  const [filterFavorites, setFilterFavorites] = useState(false);

  const { data, isLoading } = useDocumentConversations(documentId);
  const deleteMutation = useDeleteConversation();

  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  const items = data?.items ?? [];
  const filteredItems = filterFavorites
    ? items.filter((c) => isFavorite('CONVERSATION', c.id))
    : items;

  const handleDelete = (conv: Conversation) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${conv.title}"? All messages will be permanently lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(conv.id);
            } catch {
              Alert.alert('Error', 'Unable to delete conversation.');
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="conversation-history-modal"
    >
      <TouchableWithoutFeedback onPress={onClose} testID="history-backdrop">
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet} testID="history-sheet">
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.headerTitle}>Chat History</Text>
                  <Text style={styles.headerSubtitle}>
                    Saved conversations for this document
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close history"
                  testID="close-history-button"
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons: New Chat + Filter Tabs */}
              <View style={styles.controlsRow}>
                <TouchableOpacity
                  style={styles.newChatButton}
                  onPress={() => {
                    onNewChat();
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Start new chat"
                  testID="new-chat-button"
                >
                  <Text style={styles.newChatButtonText}>+ New Chat</Text>
                </TouchableOpacity>

                <View style={styles.filterTabs}>
                  <TouchableOpacity
                    style={[
                      styles.filterTab,
                      !filterFavorites && styles.filterTabActive,
                    ]}
                    onPress={() => setFilterFavorites(false)}
                    testID="filter-all-button"
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        !filterFavorites && styles.filterTabTextActive,
                      ]}
                    >
                      All ({items.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.filterTab,
                      filterFavorites && styles.filterTabActive,
                    ]}
                    onPress={() => setFilterFavorites(true)}
                    testID="filter-favorites-button"
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        filterFavorites && styles.filterTabTextActive,
                      ]}
                    >
                      ★ Favorites
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Conversations List */}
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.loadingText}>Loading history...</Text>
                </View>
              ) : filteredItems.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>
                    {filterFavorites ? '⭐' : '💬'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {filterFavorites
                      ? 'No favorite conversations yet.'
                      : 'No previous conversations found.'}
                  </Text>
                </View>
              ) : (
                <FlatList<Conversation>
                  data={filteredItems}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isActive = item.id === activeConversationId;
                    const favorited = isFavorite('CONVERSATION', item.id);

                    return (
                      <TouchableOpacity
                        style={[
                          styles.itemCard,
                          isActive && styles.itemCardActive,
                        ]}
                        onPress={() => {
                          onSelectConversation(item.id);
                          onClose();
                        }}
                        activeOpacity={0.7}
                        testID={`conversation-item-${item.id}`}
                      >
                        <View style={styles.itemMain}>
                          <View style={styles.itemTitleRow}>
                            <Text
                              style={[
                                styles.itemTitle,
                                isActive && styles.itemTitleActive,
                              ]}
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            {isActive && (
                              <View style={styles.activeBadge}>
                                <Text style={styles.activeBadgeText}>
                                  Active
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.itemDate}>
                            {formatDate(item.createdAt)}
                          </Text>
                        </View>

                        {/* Favorite & Delete Actions */}
                        <View style={styles.itemActions}>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() =>
                              toggleFavorite('CONVERSATION', item.id)
                            }
                            accessibilityRole="button"
                            accessibilityLabel={
                              favorited
                                ? 'Remove from favorites'
                                : 'Add to favorites'
                            }
                            testID={`favorite-button-${item.id}`}
                          >
                            <Text style={styles.starText}>
                              {favorited ? '★' : '☆'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => handleDelete(item)}
                            accessibilityRole="button"
                            accessibilityLabel="Delete conversation"
                            testID={`delete-conversation-${item.id}`}
                          >
                            <Text style={styles.trashText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  contentContainerStyle={styles.listContent}
                  testID="history-list"
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: 380,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  newChatButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  newChatButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#0F172A',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  listContent: {
    paddingBottom: 20,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
  },
  itemCardActive: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  itemMain: {
    flex: 1,
    marginRight: 8,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    flexShrink: 1,
  },
  itemTitleActive: {
    color: '#1D4ED8',
  },
  activeBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
  },
  itemDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 6,
  },
  starText: {
    fontSize: 18,
    color: '#EAB308',
  },
  trashText: {
    fontSize: 14,
  },
});
