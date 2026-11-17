import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Documents: undefined;
  DocumentSummary: { documentId: string; documentTitle: string };
  Flashcards: { documentId: string; documentTitle: string };
  Quiz: { documentId: string; documentTitle: string };
  Chat: { documentId: string; documentTitle: string; conversationId?: string };
  Home: undefined;
};

export type AuthNavigationProp = NativeStackNavigationProp<AuthStackParamList>;
export type AppNavigationProp = NativeStackNavigationProp<AppStackParamList>;
