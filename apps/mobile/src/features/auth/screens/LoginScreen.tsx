import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { loginRequestSchema } from '@smartstudy/shared';
import type { AuthNavigationProp } from '../../../app/navigation/types';
import { saveTokens } from '../../../shared/lib/token-storage';
import { loginUser, parseAuthErrorMessage } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';
import { AuthLink, PrimaryButton } from './components/AuthButton';
import { AuthInput, type AuthInputRef } from './components/AuthInput';
import { AuthLayout } from './components/AuthLayout';
import { colors } from './components/theme';

type Errors = { email?: string; password?: string };

export function LoginScreen() {
  const navigation = useNavigation<AuthNavigationProp>();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<AuthInputRef>(null);

  const handleLogin = async () => {
    setServerError(null);

    const parsed = loginRequestSchema.safeParse({
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
      const response = await loginUser(parsed.data);
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
      title="Welcome back"
      subtitle="Pick up where you left off."
      footer={
        <AuthLink
          prefix="New to SmartStudy?"
          action="Create an account"
          onPress={() => navigation.navigate('Register')}
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
        placeholder="Your password"
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
        autoComplete="password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={handleLogin}
      />

      <Pressable
        style={styles.forgot}
        onPress={() => {
          // MVP out of scope: password reset
        }}
        accessibilityRole="link"
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>

      <PrimaryButton label="Sign in" onPress={handleLogin} loading={loading} />
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
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 20,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.indigo,
  },
});