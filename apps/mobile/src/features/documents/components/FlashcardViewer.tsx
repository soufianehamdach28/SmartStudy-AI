import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Flashcard } from '@smartstudy/shared';

interface FlashcardViewerProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
}

export function FlashcardViewer({ card, isFlipped, onFlip }: FlashcardViewerProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: isFlipped ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [isFlipped, animatedValue]);

  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onFlip}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Flashcard. Currently showing ${isFlipped ? 'answer' : 'question'}. Tap to flip.`}
      testID="flashcard-touchable"
    >
      {/* Front Card (Question) */}
      <Animated.View
        style={[styles.card, styles.cardFront, frontAnimatedStyle]}
        testID="flashcard-front"
      >
        <View style={styles.cardHeader}>
          <View style={styles.questionBadge}>
            <Text style={styles.questionBadgeText}>QUESTION</Text>
          </View>
          <Text style={styles.flipHint}>Tap to reveal answer ↻</Text>
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.questionText}>{card.front}</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerNote}>Question side</Text>
        </View>
      </Animated.View>

      {/* Back Card (Answer) */}
      <Animated.View
        style={[styles.card, styles.cardBack, backAnimatedStyle]}
        testID="flashcard-back"
      >
        <View style={styles.cardHeader}>
          <View style={styles.answerBadge}>
            <Text style={styles.answerBadgeText}>ANSWER</Text>
          </View>
          <Text style={styles.flipHint}>Tap to view question ↻</Text>
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.answerText}>{card.back}</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerNote}>Answer side</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
    padding: 24,
    justifyContent: 'space-between',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  cardFront: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
  },
  cardBack: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  questionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  answerBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  answerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  flipHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 30,
  },
  answerText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 28,
  },
  cardFooter: {
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
