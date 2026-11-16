import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DocumentsScreen } from '../../features/documents/screens/DocumentsScreen';
import { DocumentSummaryScreen } from '../../features/documents/screens/DocumentSummaryScreen';
import { FlashcardsScreen } from '../../features/documents/screens/FlashcardsScreen';
import { HomeScreen } from '../../features/home/screens/HomeScreen';
import { QuizScreen } from '../../features/quiz/screens/QuizScreen';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="DocumentSummary" component={DocumentSummaryScreen} />
      <Stack.Screen name="Flashcards" component={FlashcardsScreen} />
      <Stack.Screen name="Quiz" component={QuizScreen} />
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: true, title: 'SmartStudy' }}
      />
    </Stack.Navigator>
  );
}
