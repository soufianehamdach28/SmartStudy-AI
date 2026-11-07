import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { registerRequestSchema } from '@smartstudy/shared';
import type { AuthNavigationProp } from '../../../app/navigation/types';
import { saveTokens } from '../../../shared/lib/token-storage';
import { parseAuthErrorMessage, registerUser } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';
import { AuthLink, PrimaryButton } from './components/AuthButton';
import { AuthInput, type AuthInputRef } from './components/AuthInput';
import { AuthLayout } from './components/AuthLayout';
import { colors } from './components/theme';

type Errors = { email?: string; password?: string };

const LEVELS = [
  { label: 'Weak', color: '#D92D20' },
  { label: 'Weak', color: '#D92D20' },
  { label: 'Okay', color: '#B45309' },
  { label: 'Good', color: '#4D7C0F' },
  { label: 'Strong', color: '#15803D' },
];

function getStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const score = getStrength(password);
  const level = LEVELS[score];

  return (
    <View style={styles.meter} testID="strength-meter">
      <View style={styles.bars}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { backgroundColor: i < score ? level.color : colors.border },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.meterLabel, { color: level.color }]}>
        {level.label}
      </Text>
    </View>
  );
}

export function RegisterScreen() {
  const navigation = useNavigation<AuthNavigationProp>();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<AuthInputRef>(null);

  const handleRegister = async () => {
    setServerError(null);

    const parsed = registerRequestSchema.safeParse({
      email: email.trim(),
      password,
    });

    if (!parsed.success) {
      const fieldErrors: Errors = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'email' && !fieldErrors.email) {
          fieldErrors.email = issue.message;
        } else if (issue.path[0] === 'password' && !fieldErrors.password) {
          fieldErrors.password = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await registerUser(parsed.data);
      await saveTokens(response.tokens);
      setAuth(response.user);
    } catch (err) {
      const message = parseAuthErrorMessage(err);
      setServerError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up in under a minute."
      footer={
        <AuthLink
          prefix="Already have an account?"
          action="Sign in"
          onPress={() => navigation.navigate('Login')}
        />
      }
    >
      {serverError ? (
        <View style={styles.serverError} accessibilityRole="alert">
          <Text style={styles.serverErrorText}>{serverError}</Text>
        </View>
      ) : null}

      <AuthInput
        label="Email"
        placeholder="you@school.edu"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (errors.email) {
            setErrors((prev) => ({ ...prev, email: undefined }));
          }
          if (serverError) setServerError(null);
        }}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />

      <AuthInput
        ref={passwordRef}
        label="Password"
        placeholder="At least 8 characters"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (errors.password) {
            setErrors((prev) => ({ ...prev, password: undefined }));
          }
          if (serverError) setServerError(null);
        }}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleRegister}
      />

      <StrengthMeter password={password} />

      <PrimaryButton
        label="Create account"
        onPress={handleRegister}
        loading={loading}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  serverError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  serverErrorText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  meter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -6,
    marginBottom: 20,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  meterLabel: {
    width: 56,
    marginLeft: 12,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
});