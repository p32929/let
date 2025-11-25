import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '@/lib/storage';

const ONBOARDING_KEY = 'onboarding_completed';

// App content data
const APP_INFO = {
  title: 'LET',
  subtitle: 'Life Events Tracker',
  description: 'LET stands for **Life Events Tracker** - a simple yet powerful app designed to help you track and understand the patterns in your daily life.',
  whyTrack: [
    'By tracking your daily activities and events, you can discover patterns that lead to your best days.',
    'Understand what habits make you feel great, identify areas for improvement, and make data-driven decisions about your life.',
  ],
};

const TRACKABLE_ITEMS = [
  { emoji: '📊', title: 'Daily Habits', description: 'Exercise, meditation, reading, water intake, and more' },
  { emoji: '💪', title: 'Health & Fitness', description: 'Sleep hours, workouts, meals, medications' },
  { emoji: '🎯', title: 'Goals & Milestones', description: 'Track progress towards your personal and professional goals' },
  { emoji: '😊', title: 'Mood & Wellbeing', description: 'Daily mood, energy levels, gratitude moments' },
  { emoji: '📝', title: 'Life Events', description: 'Important moments, achievements, experiences' },
];

const COMMITMENTS = [
  { emoji: '🌟', text: 'When you become successful and capable, you will dedicate yourself to helping others achieve their potential.' },
  { emoji: '🤝', text: 'You commit to positively impacting at least a million lives - whether through your work, words, actions, or example.' },
  { emoji: '💫', text: 'You will inspire and call others towards goodness, spreading positivity and helping build a better world.' },
  { emoji: '📚', text: 'You will share your knowledge freely for the betterment of everyone around you, holding nothing back that could help others grow.' },
  { emoji: '🙏', text: 'You will remain humble in success and grateful in all circumstances, never forgetting those who helped you along the way.' },
  { emoji: '❤️', text: 'You promise to use your success not just for yourself, but as a force for good in the lives of others.' },
];

const QUOTE = '"The best among you are those who bring the greatest benefit to others."';

const BUTTON_STATES = {
  notScrolled: 'Please read the terms above',
  waiting: (seconds: number) => `Please wait ${seconds} second${seconds !== 1 ? 's' : ''}...`,
  ready: 'I Accept & Commit to Goodness',
};

export default function OnboardingScreen() {
  const [hasScrolledToBottom, setHasScrolledToBottom] = React.useState(false);
  const [secondsRemaining, setSecondsRemaining] = React.useState(5);
  const [canAccept, setCanAccept] = React.useState(false);
  const insets = useSafeAreaInsets();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (hasScrolledToBottom && secondsRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    }

    if (secondsRemaining === 0) {
      setCanAccept(true);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [hasScrolledToBottom, secondsRemaining]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;

    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    await storage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/');
  };

  const getButtonText = () => {
    if (!hasScrolledToBottom) return BUTTON_STATES.notScrolled;
    if (secondsRemaining > 0) return BUTTON_STATES.waiting(secondsRemaining);
    return BUTTON_STATES.ready;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View
        className="flex-1 bg-white dark:bg-[#0a0a0a]"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* App Title */}
          <View className="items-center mb-8 mt-4">
            <Text className="text-5xl font-bold text-[#0a0a0a] dark:text-[#fafafa] mb-2">
              {APP_INFO.title}
            </Text>
            <Text className="text-lg text-[#737373] dark:text-[#a3a3a3] text-center">
              {APP_INFO.subtitle}
            </Text>
          </View>

          {/* What is LET */}
          <Section title={`What is ${APP_INFO.title}?`}>
            <Text className="text-base text-[#525252] dark:text-[#d4d4d4] leading-6">
              {APP_INFO.description}
            </Text>
          </Section>

          {/* What can you track */}
          <Section title="What can you track?">
            <View className="gap-3">
              {TRACKABLE_ITEMS.map((item, index) => (
                <TrackableItem key={index} {...item} />
              ))}
            </View>
          </Section>

          {/* Why track */}
          <Section title="Why track your life?">
            {APP_INFO.whyTrack.map((text, index) => (
              <Text key={index} className="text-base text-[#525252] dark:text-[#d4d4d4] leading-6 mb-2">
                {text}
              </Text>
            ))}
          </Section>

          {/* Terms & Commitment */}
          <View className="mb-8 bg-[#f5f5f5] dark:bg-[#171717] rounded-xl p-5">
            <Text className="text-2xl font-bold text-[#0a0a0a] dark:text-[#fafafa] mb-4">
              A Commitment to Goodness
            </Text>
            <Text className="text-base text-[#525252] dark:text-[#d4d4d4] leading-6 mb-4">
              By using this app, you agree to the following commitment:
            </Text>

            <View className="gap-4">
              {COMMITMENTS.map((commitment, index) => (
                <CommitmentItem key={index} {...commitment} />
              ))}
            </View>

            <Text className="text-sm text-[#737373] dark:text-[#a3a3a3] mt-5 italic text-center">
              {QUOTE}
            </Text>
          </View>

          {/* Scroll indicator */}
          {!hasScrolledToBottom && (
            <View className="items-center py-4">
              <Text className="text-sm text-[#737373] dark:text-[#a3a3a3] text-center">
                ↓ Scroll down to continue ↓
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Fixed bottom button */}
        <View
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a] border-t border-[#e5e5e5] dark:border-[#262626] p-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Button
            onPress={handleAccept}
            disabled={!canAccept}
            className={`h-14 ${canAccept ? 'bg-[#171717] dark:bg-[#fafafa]' : 'bg-[#e5e5e5] dark:bg-[#333333]'}`}
          >
            <Text className={`font-semibold text-base ${canAccept ? 'text-white dark:text-[#0a0a0a]' : 'text-[#525252] dark:text-[#a3a3a3]'}`}>
              {getButtonText()}
            </Text>
          </Button>
        </View>
      </View>
    </>
  );
}

// Reusable components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-8">
      <Text className="text-2xl font-bold text-[#0a0a0a] dark:text-[#fafafa] mb-4">
        {title}
      </Text>
      {children}
    </View>
  );
}

function TrackableItem({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <View className="flex-row items-start">
      <Text className="text-xl mr-3">{emoji}</Text>
      <View className="flex-1">
        <Text className="font-semibold text-[#0a0a0a] dark:text-[#fafafa]">{title}</Text>
        <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">{description}</Text>
      </View>
    </View>
  );
}

function CommitmentItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View className="flex-row items-start">
      <Text className="text-lg mr-3">{emoji}</Text>
      <Text className="flex-1 text-base text-[#525252] dark:text-[#d4d4d4] leading-6">
        {text}
      </Text>
    </View>
  );
}

// Export functions
export async function isOnboardingCompleted(): Promise<boolean> {
  const value = await storage.getItem(ONBOARDING_KEY);
  return value === 'true';
}

export async function resetOnboarding(): Promise<void> {
  await storage.removeItem(ONBOARDING_KEY);
}
