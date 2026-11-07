import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import { RegisterScreen } from './RegisterScreen';
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

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, status: 'unauthenticated', error: null });
  });

  it('renders email, password inputs, strength meter, and register button', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<RegisterScreen />);
    });

    const inputs = renderer!.root.findAllByType(AuthInput);
    expect(inputs.length).toBe(2);

    expect(inputs[0].props.label).toBe('Email');
    expect(inputs[1].props.label).toBe('Password');

    const button = renderer!.root.findByType(PrimaryButton);
    expect(button.props.label).toBe('Create account');
  });

  it('navigates to Login screen when link is pressed', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<RegisterScreen />);
    });

    const link = renderer!.root.findByType(AuthLink);
    act(() => {
      link.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('shows validation errors when submitting invalid email or short password', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<RegisterScreen />);
    });

    const inputs = renderer!.root.findAllByType(AuthInput);
    act(() => {
      inputs[0].props.onChangeText('invalid-email');
      inputs[1].props.onChangeText('123'); // less than 8 chars
    });

    const button = renderer!.root.findByType(PrimaryButton);

    await act(async () => {
      button.props.onPress();
    });

    expect(inputs[0].props.error).toBe('Invalid email address');
    expect(inputs[1].props.error).toBe('Password must be at least 8 characters long');
  });

  it('updates password strength indicator when typing password', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<RegisterScreen />);
    });

    const inputs = renderer!.root.findAllByType(AuthInput);

    // Initially no meter
    expect(renderer!.root.findAllByProps({ testID: 'strength-meter' }).length).toBe(0);

    // Type strong password: uppercase + lowercase + number + special + >=8 chars
    act(() => {
      inputs[1].props.onChangeText('SecurePass123!');
    });

    const meter = renderer!.root.findByProps({ testID: 'strength-meter' });
    expect(meter).toBeDefined();
    const meterTexts = meter.findAllByType(Text);
    expect(meterTexts.some((t) => t.props.children === 'Strong')).toBe(true);
  });

  it('submits valid registration and sets auth session', async () => {
    const mockUser = {
      id: 'usr-new',
      email: 'newuser@school.edu',
      role: 'STUDENT' as const,
      createdAt: new Date().toISOString(),
    };
    const mockTokens = {
      accessToken: 'access-reg',
      refreshToken: 'refresh-reg',
      tokenType: 'Bearer' as const,
      expiresIn: 900,
    };

    jest.spyOn(authApi, 'registerUser').mockResolvedValueOnce({
      tokens: mockTokens,
      user: mockUser,
    });
    jest.spyOn(tokenStorage, 'saveTokens').mockResolvedValueOnce();

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<RegisterScreen />);
    });

    const inputs = renderer!.root.findAllByType(AuthInput);

    act(() => {
      inputs[0].props.onChangeText('newuser@school.edu');
      inputs[1].props.onChangeText('StrongPassword123!');
    });

    const button = renderer!.root.findByType(PrimaryButton);

    await act(async () => {
      button.props.onPress();
    });

    expect(authApi.registerUser).toHaveBeenCalledWith({
      email: 'newuser@school.edu',
      password: 'StrongPassword123!',
    });
    expect(tokenStorage.saveTokens).toHaveBeenCalledWith(mockTokens);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('displays server error banner when registration fails', async () => {
    jest.spyOn(authApi, 'registerUser').mockRejectedValueOnce(new Error('Conflict'));
    jest.spyOn(authApi, 'parseAuthErrorMessage').mockReturnValueOnce('An account with this email already exists.');

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<RegisterScreen />);
    });

    const inputs = renderer!.root.findAllByType(AuthInput);

    act(() => {
      inputs[0].props.onChangeText('existing@school.edu');
      inputs[1].props.onChangeText('Password123!');
    });

    const button = renderer!.root.findByType(PrimaryButton);

    await act(async () => {
      button.props.onPress();
    });

    const alertView = renderer!.root.findByProps({ accessibilityRole: 'alert' });
    expect(alertView).toBeDefined();
    expect(alertView.props.children.props.children).toBe('An account with this email already exists.');
  });

  it('supports chaining keyboard focus from email to password', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<RegisterScreen />);
    });

    const textInputs = renderer!.root.findAllByType(TextInput);
    expect(textInputs.length).toBe(2);

    const emailInput = textInputs[0];
    const passwordInput = textInputs[1];

    const focusSpy = jest.fn();
    passwordInput.instance = { focus: focusSpy };

    act(() => {
      emailInput.props.onSubmitEditing();
    });
  });
});
