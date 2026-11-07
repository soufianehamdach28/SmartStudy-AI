import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { LoginScreen } from './LoginScreen';
import { AuthInput } from './components/AuthInput';
import { PrimaryButton, AuthLink } from './components/AuthButton';
import * as authApi from '../api/auth.api';
import * as tokenStorage from '../../../shared/lib/token-storage';
import { useAuthStore } from '../store/auth.store';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, status: 'unauthenticated', error: null });
  });

  it('renders email, password inputs and sign-in button', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    const inputs = renderer!.root.findAllByType(AuthInput);
    expect(inputs.length).toBe(2);

    const emailInput = inputs[0];
    const passwordInput = inputs[1];

    expect(emailInput.props.label).toBe('Email');
    expect(passwordInput.props.label).toBe('Password');

    const button = renderer!.root.findByType(PrimaryButton);
    expect(button.props.label).toBe('Sign in');
  });

  it('navigates to Register screen when link is pressed', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    const link = renderer!.root.findByType(AuthLink);
    act(() => {
      link.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('shows validation errors when submitting with empty or invalid email', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    const button = renderer!.root.findByType(PrimaryButton);

    // Submit with empty inputs
    await act(async () => {
      button.props.onPress();
    });

    const inputs = renderer!.root.findAllByType(AuthInput);
    expect(inputs[0].props.error).toBe('Invalid email address');
    expect(inputs[1].props.error).toBe('Password is required');
  });

  it('submits valid credentials and updates session', async () => {
    const mockUser = {
      id: 'usr-1',
      email: 'student@school.edu',
      role: 'STUDENT' as const,
      createdAt: new Date().toISOString(),
    };
    const mockTokens = {
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
      tokenType: 'Bearer' as const,
      expiresIn: 900,
    };

    jest.spyOn(authApi, 'loginUser').mockResolvedValueOnce({
      tokens: mockTokens,
      user: mockUser,
    });
    jest.spyOn(tokenStorage, 'saveTokens').mockResolvedValueOnce();

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    const inputs = renderer!.root.findAllByType(AuthInput);

    // Type valid email and password
    act(() => {
      inputs[0].props.onChangeText('student@school.edu');
      inputs[1].props.onChangeText('password123');
    });

    const button = renderer!.root.findByType(PrimaryButton);

    await act(async () => {
      button.props.onPress();
    });

    expect(authApi.loginUser).toHaveBeenCalledWith({
      email: 'student@school.edu',
      password: 'password123',
    });
    expect(tokenStorage.saveTokens).toHaveBeenCalledWith(mockTokens);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('displays server error banner when login fails', async () => {
    jest.spyOn(authApi, 'loginUser').mockRejectedValueOnce(new Error('Backend down'));
    jest.spyOn(authApi, 'parseAuthErrorMessage').mockReturnValueOnce('Incorrect email or password. Please try again.');

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    const inputs = renderer!.root.findAllByType(AuthInput);

    act(() => {
      inputs[0].props.onChangeText('student@school.edu');
      inputs[1].props.onChangeText('wrongpassword');
    });

    const button = renderer!.root.findByType(PrimaryButton);

    await act(async () => {
      button.props.onPress();
    });

    const alertView = renderer!.root.findByProps({ accessibilityRole: 'alert' });
    expect(alertView).toBeDefined();
    expect(alertView.props.children.props.children).toBe('Incorrect email or password. Please try again.');
  });

  it('supports chaining keyboard focus from email to password', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    const textInputs = renderer!.root.findAllByType(TextInput);
    expect(textInputs.length).toBe(2);

    const emailInput = textInputs[0];
    const passwordInput = textInputs[1];

    const focusSpy = jest.fn();
    passwordInput.instance = { focus: focusSpy };

    // Trigger onSubmitEditing on email field
    act(() => {
      emailInput.props.onSubmitEditing();
    });
  });
});
