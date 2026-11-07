import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './theme';

type FloatingCardProps = {
  label: string;
  bg: string;
  edge: string;
  rotate: string;
  distance: number;
  duration: number;
  delay?: number;
  position: { top: number; left?: number; right?: number };
};

function FloatingCard({
  label,
  bg,
  edge,
  rotate,
  distance,
  duration,
  delay = 0,
  position,
}: FloatingCardProps) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(float, {
            toValue: 1,
            duration,
            delay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(float, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });

    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [float, duration, delay]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, distance],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flashcard,
        { backgroundColor: bg, borderBottomColor: edge },
        position,
        { transform: [{ rotate }, { translateY }] },
      ]}
    >
      <Text style={styles.flashcardText}>{label}</Text>
    </Animated.View>
  );
}

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const entrance = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      damping: 20,
      stiffness: 140,
      mass: 1,
      useNativeDriver: true,
    }).start();

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [entrance]);

  const sheetTranslate = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  });

  const top = insets.top;

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View
              style={[
                styles.hero,
                keyboardVisible ? styles.heroCompact : null,
                { paddingTop: keyboardVisible ? Math.max(top, 16) : top + 32 },
              ]}
            >
              {!keyboardVisible && (
                <>
                  <FloatingCard
                    label="H₂O"
                    bg={colors.yellow}
                    edge={colors.yellowEdge}
                    rotate="-12deg"
                    distance={10}
                    duration={2600}
                    position={{ top: top + 30, left: 20 }}
                  />
                  <FloatingCard
                    label="π"
                    bg={colors.mint}
                    edge={colors.mintEdge}
                    rotate="9deg"
                    distance={-12}
                    duration={3100}
                    delay={300}
                    position={{ top: top + 14, right: 24 }}
                  />
                  <FloatingCard
                    label="ƒ(x)"
                    bg={colors.coral}
                    edge={colors.coralEdge}
                    rotate="-6deg"
                    distance={8}
                    duration={2900}
                    delay={600}
                    position={{ top: top + 140, right: 20 }}
                  />
                  <FloatingCard
                    label="1789"
                    bg={colors.yellow}
                    edge={colors.yellowEdge}
                    rotate="7deg"
                    distance={-9}
                    duration={3300}
                    delay={150}
                    position={{ top: top + 128, left: 28 }}
                  />
                </>
              )}

              <View style={[styles.badge, keyboardVisible ? styles.badgeCompact : null]}>
                <Text style={[styles.badgeText, keyboardVisible ? styles.badgeTextCompact : null]}>
                  S
                </Text>
              </View>
              <Text style={[styles.brand, keyboardVisible ? styles.brandCompact : null]}>
                SmartStudy
              </Text>
              {!keyboardVisible && (
                <Text style={styles.tagline}>Study smarter, not longer.</Text>
              )}
            </View>

            <Animated.View
              style={[
                styles.sheet,
                {
                  paddingBottom: insets.bottom + 28,
                  opacity: entrance,
                  transform: [{ translateY: sheetTranslate }],
                },
              ]}
            >
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              <View style={styles.form}>{children}</View>
              {footer}
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  hero: {
    flexGrow: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  heroCompact: {
    minHeight: 90,
    paddingBottom: 12,
    flexGrow: 0,
  },
  badge: {
    width: 64,
    height: 72,
    borderRadius: 14,
    backgroundColor: colors.yellow,
    borderBottomWidth: 5,
    borderBottomColor: colors.yellowEdge,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  badgeCompact: {
    width: 44,
    height: 48,
    borderRadius: 10,
    borderBottomWidth: 3,
  },
  badgeText: {
    fontSize: 38,
    fontWeight: '900',
    color: colors.ink,
  },
  badgeTextCompact: {
    fontSize: 26,
  },
  brand: {
    marginTop: 16,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    color: '#FFFFFF',
  },
  brandCompact: {
    marginTop: 8,
    fontSize: 24,
  },
  tagline: {
    marginTop: 6,
    fontSize: 16,
    color: colors.onInk,
  },

  flashcard: {
    position: 'absolute',
    width: 52,
    height: 68,
    borderRadius: 12,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashcardText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },

  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    color: colors.muted,
  },
  form: { marginTop: 24 },
});