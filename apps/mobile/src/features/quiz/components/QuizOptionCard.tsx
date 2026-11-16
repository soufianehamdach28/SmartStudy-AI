import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface QuizOptionCardProps {
  label: string;
  optionText: string;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function QuizOptionCard({
  label,
  optionText,
  isSelected,
  onSelect,
  disabled = false,
}: QuizOptionCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onSelect}
      disabled={disabled}
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        disabled && styles.cardDisabled,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Option ${label}: ${optionText}`}
      testID={`quiz-option-${label}`}
    >
      <View style={[styles.badge, isSelected && styles.badgeSelected]}>
        <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
        {optionText}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  cardDisabled: {
    opacity: 0.7,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  badgeSelected: {
    backgroundColor: '#4F46E5',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  badgeTextSelected: {
    color: '#FFFFFF',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    lineHeight: 22,
  },
  optionTextSelected: {
    color: '#312E81',
    fontWeight: '600',
  },
});
