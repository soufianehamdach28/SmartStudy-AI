import { forwardRef, useRef, useState, type ElementRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { colors } from './theme';

export type AuthInputRef = ElementRef<typeof TextInput>;

type Props = TextInputProps & {
  label: string;
  error?: string;
};

export const AuthInput = forwardRef<AuthInputRef, Props>(function AuthInputComponent(
  {
    label,
    error,
    secureTextEntry,
    onFocus,
    onBlur,
    ...rest
  }: Props,
  ref,
) {
  const [hidden, setHidden] = useState(true);
  const focus = useRef(new Animated.Value(0)).current;

  const animate = (toValue: number) =>
    Animated.timing(focus, {
      toValue,
      duration: 180,
      useNativeDriver: false, // color interpolation can't use the native driver
    }).start();

  const borderColor = error
    ? colors.error
    : focus.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', colors.indigo],
      });

  const backgroundColor = focus.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.field, colors.fieldFocus],
  });

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <Animated.View style={[styles.field, { borderColor, backgroundColor }]}>
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          selectionColor={colors.indigo}
          secureTextEntry={secureTextEntry && hidden}
          onFocus={(e) => {
            animate(1);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            animate(0);
            onBlur?.(e);
          }}
          {...rest}
        />

        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Text style={styles.toggle}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: colors.text,
  },
  toggle: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '700',
    color: colors.indigo,
  },
  error: {
    marginTop: 6,
    fontSize: 13,
    color: colors.error,
  },
});