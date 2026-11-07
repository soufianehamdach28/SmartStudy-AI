import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from './theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
};

export function PrimaryButton({ label, onPress, loading }: PrimaryButtonProps) {
  const press = useRef(new Animated.Value(0)).current;

  const to = (toValue: number) =>
    Animated.timing(press, {
      toValue,
      duration: 90,
      useNativeDriver: true,
    }).start();

  const translateY = press.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4],
  });

  return (
    <Pressable
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ busy: !!loading, disabled: !!loading }}
    >
      {/* The darker outer view is the button's "edge"; the face presses down over it */}
      <View style={styles.edge}>
        <Animated.View style={[styles.face, { transform: [{ translateY }] }]}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.label}>{label}</Text>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

type AuthLinkProps = {
  prefix: string;
  action: string;
  onPress: () => void;
};

export function AuthLink({ prefix, action, onPress }: AuthLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.link}
      accessibilityRole="link"
      accessibilityLabel={`${prefix} ${action}`}
    >
      <Text style={styles.linkText}>
        {prefix} <Text style={styles.linkAction}>{action}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: {
    backgroundColor: colors.indigoEdge,
    borderRadius: 16,
    paddingBottom: 4,
  },
  face: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  link: {
    alignSelf: 'center',
    marginTop: 20,
    padding: 8,
  },
  linkText: {
    fontSize: 15,
    color: colors.muted,
  },
  linkAction: {
    fontWeight: '700',
    color: colors.indigo,
  },
});