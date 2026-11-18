import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../../app/navigation/types';
import { EmptyView } from '../../../shared/components/EmptyView';
import { ErrorView } from '../../../shared/components/ErrorView';
import { LoadingView } from '../../../shared/components/LoadingView';
import { OfflineView } from '../../../shared/components/OfflineView';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { parseDocumentErrorMessage } from '../api/documents.api';
import { FlashcardViewer } from '../components/FlashcardViewer';
import { useFavoritesStore } from '../../../shared/store/favorites.store';
import {
  useFlashcards,
  useRegenerateFlashcards,
} from '../hooks/useFlashcards';

type Props = NativeStackScreenProps<AppStackParamList, 'Flashcards'>;

export function FlashcardsScreen({ route, navigation }: Props) {
  const { documentId, documentTitle } = route.params;

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useFlashcards(documentId);
  const regenerateMutation = useRegenerateFlashcards(documentId);
  const { isOffline } = useNetworkStatus();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);

  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  const allFlashcards = data?.flashcards ?? [];
  const flashcards = filterFavoritesOnly
    ? allFlashcards.filter((card) => isFavorite('FLASHCARD', card.id))
    : allFlashcards;

  const totalCards = flashcards.length;
  const currentCard = flashcards[currentIndex];
  const isCurrentCardFavorite = currentCard
    ? isFavorite('FLASHCARD', currentCard.id)
    : false;

  const handleNext = () => {
    if (currentIndex < totalCards - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleRestart = () => {
    setIsFlipped(false);
    setCurrentIndex(0);
    setIsCompleted(false);
  };

  const handleRegenerate = async () => {
    if (isOffline) {
      Alert.alert('Offline', 'Cannot regenerate flashcards while offline.');
      return;
    }

    try {
      await regenerateMutation.mutateAsync(10);
      handleRestart();
    } catch (err) {
      Alert.alert('Regeneration Failed', parseDocumentErrorMessage(err));
    }
  };

  const isWorking = isLoading || isRefetching || regenerateMutation.isPending;
  const progressPercent =
    totalCards > 0 ? Math.round(((currentIndex + 1) / totalCards) * 100) : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle} numberOfLines={1}>
          {documentTitle}
        </Text>
        <TouchableOpacity
          onPress={handleRegenerate}
          disabled={isWorking}
          style={styles.appBarAction}
          accessibilityRole="button"
          accessibilityLabel="Regenerate flashcards"
        >
          <Text style={styles.appBarActionText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Mandatory AI Disclaimer Notice (Security Rule #12) */}
      <View style={styles.disclaimerBanner} testID="ai-disclaimer-banner">
        <Text style={styles.disclaimerIcon}>⚠️</Text>
        <Text style={styles.disclaimerText}>
          <Text style={styles.disclaimerBold}>AI answers may be incorrect.</Text>{' '}
          Verify answers with course materials.
        </Text>
      </View>

      {/* Screen States */}
      {isWorking && !data ? (
        <LoadingView message="Generating flashcards with AI..." />
      ) : isError ? (
        isOffline ? (
          <OfflineView
            title="Flashcards Offline"
            message="Cannot load flashcards while offline. Please check your connection."
            onRetry={refetch}
          />
        ) : (
          <ErrorView
            message={parseDocumentErrorMessage(error)}
            onRetry={refetch}
          />
        )
      ) : totalCards === 0 ? (
        filterFavoritesOnly ? (
          <EmptyView
            title="No favorite flashcards"
            description="You haven't starred any flashcards yet. Tap the star icon on any card to study it here."
            actionLabel="Show All Cards"
            onAction={() => {
              setFilterFavoritesOnly(false);
              setCurrentIndex(0);
              setIsFlipped(false);
              setIsCompleted(false);
            }}
          />
        ) : (
          <EmptyView
            title="No flashcards available"
            description="We couldn't generate flashcards for this document."
            actionLabel="Generate Now"
            onAction={handleRegenerate}
          />
        )
      ) : isCompleted ? (
        /* Completion View */
        <View style={styles.completedContainer} testID="flashcards-completed-view">
          <View style={styles.completedCard}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>Great Study Session!</Text>
            <Text style={styles.completedSubtitle}>
              You reviewed all {totalCards} flashcards in this set.
            </Text>

            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={handleRestart}
              accessibilityRole="button"
              accessibilityLabel="Review again"
            >
              <Text style={styles.primaryActionButtonText}>Review Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back to documents"
            >
              <Text style={styles.secondaryActionButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Flashcard Study Flow */
        <View style={styles.studyContainer}>
          {/* Progress Header */}
          <View style={styles.progressHeader}>
            <View style={styles.progressRow}>
              <View style={styles.cardCountGroup}>
                <Text style={styles.progressCountText}>
                  Card {currentIndex + 1} of {totalCards}
                </Text>
                {Boolean(currentCard) && (
                  <TouchableOpacity
                    style={styles.cardFavoriteButton}
                    onPress={() =>
                      currentCard &&
                      toggleFavorite('FLASHCARD', currentCard.id)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      isCurrentCardFavorite
                        ? 'Remove from favorites'
                        : 'Add to favorites'
                    }
                    testID="favorite-flashcard-button"
                  >
                    <Text style={styles.cardStarIcon}>
                      {isCurrentCardFavorite ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterGroup}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filterFavoritesOnly && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setFilterFavoritesOnly(!filterFavoritesOnly);
                    setCurrentIndex(0);
                    setIsFlipped(false);
                    setIsCompleted(false);
                  }}
                  testID="filter-favorites-flashcards"
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterFavoritesOnly && styles.filterChipTextActive,
                    ]}
                  >
                    {filterFavoritesOnly ? '★ Starred' : '☆ Filter Starred'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.progressPercentText}>{progressPercent}%</Text>
              </View>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                testID="flashcard-progress-bar"
              />
            </View>
          </View>

          {/* Interactive Card */}
          <View style={styles.cardWrapper}>
            <FlashcardViewer
              card={currentCard}
              isFlipped={isFlipped}
              onFlip={handleFlip}
            />
          </View>

          {/* Navigation Controls */}
          <View style={styles.navigationControls}>
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonSecondary,
                currentIndex === 0 && styles.navButtonDisabled,
              ]}
              onPress={handlePrev}
              disabled={currentIndex === 0}
              accessibilityRole="button"
              accessibilityLabel="Previous card"
            >
              <Text
                style={[
                  styles.navButtonSecondaryText,
                  currentIndex === 0 && styles.navButtonDisabledText,
                ]}
              >
                ← Prev
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, styles.navButtonPrimary]}
              onPress={handleNext}
              accessibilityRole="button"
              accessibilityLabel={
                currentIndex === totalCards - 1 ? 'Finish review' : 'Next card'
              }
            >
              <Text style={styles.navButtonPrimaryText}>
                {currentIndex === totalCards - 1 ? 'Finish ✓' : 'Next →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  appBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4F46E5',
  },
  appBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  appBarAction: {
    minWidth: 40,
    alignItems: 'flex-end',
    paddingVertical: 4,
  },
  appBarActionText: {
    fontSize: 20,
    color: '#4F46E5',
    fontWeight: '600',
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
  },
  disclaimerIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  disclaimerBold: {
    fontWeight: '700',
  },
  studyContainer: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  progressHeader: {
    marginTop: 14,
    marginBottom: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardCountGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardFavoriteButton: {
    padding: 2,
  },
  cardStarIcon: {
    fontSize: 18,
    color: '#EAB308',
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  filterChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#B45309',
  },
  progressCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 3,
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  navigationControls: {
    flexDirection: 'row',
    gap: 12,
  },
  navButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  navButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  navButtonPrimary: {
    backgroundColor: '#4F46E5',
  },
  navButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonDisabledText: {
    color: '#94A3B8',
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completedCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  completedEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  completedSubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  primaryActionButton: {
    backgroundColor: '#4F46E5',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryActionButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
});
