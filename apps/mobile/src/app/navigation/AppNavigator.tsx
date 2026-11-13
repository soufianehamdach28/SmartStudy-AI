import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DocumentsScreen } from '../../features/documents/screens/DocumentsScreen';
import { HomeScreen } from '../../features/home/screens/HomeScreen';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: true, title: 'SmartStudy' }}
      />
    </Stack.Navigator>
  );
}
