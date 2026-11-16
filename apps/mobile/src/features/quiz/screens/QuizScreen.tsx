import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../../app/navigation/types';
import type { QuizAttemptResponse } from '@smartstudy/shared';
import { EmptyView } from '../../../shared/components/EmptyView';
import { ErrorView } from '../../../shared/components/ErrorView';
import { LoadingView } from '../../../shared/components/LoadingView';
import { parseQuizErrorMessage } from '../api/quiz.api';
import { QuizOptionCard } from '../components/QuizOptionCard';
import { ScoreReviewModal } from '../components/ScoreReviewModal';
import {
  useDocumentQuiz,
  useGenerateNewQuiz,
  useSubmitQuizAttempt,
} from '../hooks/useQuiz';

type Props = NativeStackScreenProps<AppStackParamList, 'Quiz'>;

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function QuizScreen({ route, navigation }: Props) {
  const { documentId, documentTitle } = route.params;

  const { data: quiz, isLoading, isError, error, refetch, isRefetching } =
    useDocumentQuiz(documentId);
  const generateNewMutation = useGenerateNewQuiz(documentId);
  const submitMutation = useSubmitQuizAttempt();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [attemptResult, setAttemptResult] = useState<QuizAttemptResponse | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  const questions = quiz?.questions ?? [];
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (index: number) => {
    if (!currentQuestion) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: index,
    }));
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;

    // Check for unanswered questions
    const unansweredCount = questions.filter(
      (q) => selectedAnswers[q.id] === undefined,
    ).length;

    if (unansweredCount > 0) {
      Alert.alert(
        'Incomplete Quiz',
        `You have ${unansweredCount} unanswered question(s). Please answer all questions before submitting.`,
      );
      return;
    }

    try {
      const payload = {
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedIndex: selectedAnswers[q.id],
        })),
      };

      const result = await submitMutation.mutateAsync({
        quizId: quiz.id,
        data: payload,
      });

      setAttemptResult(result);
      setReviewModalVisible(true);
    } catch (err) {
      Alert.alert('Submission Failed', parseQuizErrorMessage(err));
    }
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setCurrentIndex(0);
    setAttemptResult(null);
    setReviewModalVisible(false);
  };

  const handleGenerateNew = async () => {
    try {
      await generateNewMutation.mutateAsync(5);
      handleResetQuiz();
    } catch (err) {
      Alert.alert('Quiz Generation Failed', parseQuizErrorMessage(err));
    }
  };

  const isWorking =
    isLoading ||
    isRefetching ||
    generateNewMutation.isPending ||
    submitMutation.isPending;

  const currentSelection = currentQuestion ? selectedAnswers[currentQuestion.id] : undefined;
  const progressPercent =
    totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;
  const answeredCount = Object.keys(selectedAnswers).length;

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
          onPress={handleGenerateNew}
          disabled={isWorking}
          style={styles.appBarAction}
          accessibilityRole="button"
          accessibilityLabel="Generate new quiz"
        >
          <Text style={styles.appBarActionText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Mandatory AI Disclaimer Notice (Security Rule #12) */}
      <View style={styles.disclaimerBanner} testID="ai-disclaimer-banner">
        <Text style={styles.disclaimerIcon}>⚠️</Text>
        <Text style={styles.disclaimerText}>
          <Text style={styles.disclaimerBold}>AI answers may be incorrect.</Text>{' '}
          Verify answers against your study material.
        </Text>
      </View>

      {/* Screen States */}
      {isWorking && !quiz ? (
        <LoadingView message="Preparing quiz with AI..." />
      ) : isError ? (
        <ErrorView message={parseQuizErrorMessage(error)} onRetry={refetch} />
      ) : totalQuestions === 0 ? (
        <EmptyView
          title="No quiz available"
          description="Could not generate a quiz for this document."
          actionLabel="Generate Quiz"
          onAction={handleGenerateNew}
        />
      ) : (
        <View style={styles.quizContainer}>
          {/* Progress Header */}
          <View style={styles.progressHeader}>
            <View style={styles.progressRow}>
              <Text style={styles.progressCountText}>
                Question {currentIndex + 1} of {totalQuestions}
              </Text>
              <Text style={styles.progressAnsweredText}>
                {answeredCount}/{totalQuestions} answered
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                testID="quiz-progress-bar"
              />
            </View>
          </View>

          {/* Active Question & Options */}
          <ScrollView
            style={styles.questionScroll}
            contentContainerStyle={styles.questionContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.questionCard}>
              <Text style={styles.questionPrompt}>{currentQuestion.prompt}</Text>
            </View>

            <View style={styles.optionsList}>
              {currentQuestion.options.map((option, idx) => (
                <QuizOptionCard
                  key={idx}
                  label={OPTION_LETTERS[idx]}
                  optionText={option}
                  isSelected={currentSelection === idx}
                  onSelect={() => handleSelectOption(idx)}
                />
              ))}
            </View>
          </ScrollView>

          {/* Navigation & Submit Controls */}
          <View style={styles.footerControls}>
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonSecondary,
                currentIndex === 0 && styles.navButtonDisabled,
              ]}
              onPress={handlePrev}
              disabled={currentIndex === 0}
              accessibilityRole="button"
              accessibilityLabel="Previous question"
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

            {currentIndex === totalQuestions - 1 ? (
              <TouchableOpacity
                style={[
                  styles.navButton,
                  styles.submitButton,
                  submitMutation.isPending && styles.navButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Submit quiz answers"
                testID="submit-quiz-button"
              >
                <Text style={styles.submitButtonText}>
                  {submitMutation.isPending ? 'Grading...' : 'Submit Quiz ✓'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonPrimary]}
                onPress={handleNext}
                accessibilityRole="button"
                accessibilityLabel="Next question"
              >
                <Text style={styles.navButtonPrimaryText}>Next →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Score Review Modal */}
      <ScoreReviewModal
        visible={reviewModalVisible}
        attempt={attemptResult}
        questions={questions}
        onClose={() => setReviewModalVisible(false)}
        onRetry={handleResetQuiz}
      />
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
  quizContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  progressHeader: {
    marginTop: 12,
    marginBottom: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressAnsweredText: {
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
  questionScroll: {
    flex: 1,
  },
  questionContent: {
    paddingVertical: 12,
    paddingBottom: 24,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  questionPrompt: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 26,
  },
  optionsList: {
    marginBottom: 8,
  },
  footerControls: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
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
  submitButton: {
    backgroundColor: '#16A34A',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonDisabledText: {
    color: '#94A3B8',
  },
});
