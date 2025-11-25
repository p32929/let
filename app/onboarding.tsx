import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '@/lib/storage';

const ONBOARDING_KEY = 'onboarding_completed';

export default function OnboardingScreen() {
  const [hasScrolledToBottom, setHasScrolledToBottom] = React.useState(false);
  const [secondsRemaining, setSecondsRemaining] = React.useState(5);
  const [canAccept, setCanAccept] = React.useState(false);
  const insets = useSafeAreaInsets();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start countdown when user scrolls to bottom
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
    const paddingToBottom = 50;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    await storage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <View
        className="flex-1 bg-white dark:bg-[#0a0a0a]"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
        >
          {/* App Title */}
          <View className="items-center mb-8 mt-4">
            <Text className="text-5xl font-bold text-[#0a0a0a] dark:text-[#fafafa] mb-2">
              LET
            </Text>
            <Text className="text-lg text-[#737373] dark:text-[#a3a3a3] text-center">
              Life Events Tracker
            </Text>
          </View>

          {/* What is LET */}
          <View className="mb-8">
            <Text className="text-2xl font-bold text-[#0a0a0a] dark:text-[#fafafa] mb-4">
              What is LET?
            </Text>
            <Text className="text-base text-[#525252] dark:text-[#d4d4d4] leading-6 mb-3">
              LET stands for <Text className="font-bold">Life Events Tracker</Text> - a simple yet powerful app designed to help you track and understand the patterns in your daily life.
            </Text>
          </View>

          {/* What can you track */}
          <View className="mb-8">
            <Text className="text-2xl font-bold text-[#0a0a0a] dark:text-[#fafafa] mb-4">
              What can you track?
            </Text>

            <View className="gap-3">
              <View className="flex-row items-start">
                <Text className="text-xl mr-3">📊</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-[#0a0a0a] dark:text-[#fafafa]">Daily Habits</Text>
                  <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">
                    Exercise, meditation, reading, water intake, and more
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start">
                <Text className="text-xl mr-3">💪</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-[#0a0a0a] dark:text-[#fafafa]">Health & Fitness</Text>
                  <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">
                    Sleep hours, workouts, meals, medications
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start">
                <Text className="text-xl mr-3">🎯</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-[#0a0a0a] dark:text-[#fafafa]">Goals & Milestones</Text>
                  <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">
                    Track progress towards your personal and professional goals
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start">
                <Text className="text-xl mr-3">😊</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-[#0a0a0a] dark:text-[#fafafa]">Mood & Wellbeing</Text>
                  <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">
                    Daily mood, energy levels, gratitude moments
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start">
                <Text className="text-xl mr-3">📝</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-[#0a0a0a] dark:text-[#fafafa]">Life Events</Text>
                  <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">
                    Important moments, achievements, experiences
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Why track */}
          <View className="mb-8">
            <Text className="text-2xl font-bold text-[#0a0a0a] dark:text-[#fafafa] mb-4">
              Why track your life?
            </Text>
            <Text className="text-base text-[#525252] dark:text-[#d4d4d4] leading-6 mb-3">
              By tracking your daily activities and events, you can discover patterns that lead to your best days. Understand what habits make you feel great, identify areas for improvement, and make data-driven decisions about your life.
            </Text>
            <Text className="text-base text-[#525252] dark:text-[#d4d4d4] leading-6">
              LET helps you visualize your progress with beautiful charts and pattern analysis, making self-improvement tangible and rewarding.
            </Text>
          </View>

          {/* Terms & Commitment */}
          <View className="mb-8 bg-[#f5f5f5] dark:bg-[#171717] rounded-xl p-5">
            <Text className="text-2xl font-bold text-[#0a0a0a] dark:text-[#fafafa] mb-4">
              A Commitment to Goodness
            </Text>
            <Text className="text-base text-[#525252] dark:text-[#d4d4d4] leading-6 mb-4">
              By using this app, you agree to the following commitment:
            </Text>

            <View className="gap-4">
              <View className="flex-row items-start">
                <Text className="text-lg mr-3">🌟</Text>
                <Text className="flex-1 text-base text-[#525252] dark:text-[#d4d4d4] leading-6">
                  When you become successful and capable, you will dedicate yourself to helping others achieve their potential.
                </Text>
              </View>

              <View className="flex-row items-start">
                <Text className="text-lg mr-3">🤝</Text>
                <Text className="flex-1 text-base text-[#525252] dark:text-[#d4d4d4] leading-6">
                  You commit to positively impacting at least a million lives - whether through your work, words, actions, or example.
                </Text>
              </View>

              <View className="flex-row items-start">
                <Text className="text-lg mr-3">💫</Text>
                <Text className="flex-1 text-base text-[#525252] dark:text-[#d4d4d4] leading-6">
                  You will inspire and call others towards goodness, spreading positivity and helping build a better world.
                </Text>
              </View>

              <View className="flex-row items-start">
                <Text className="text-lg mr-3">❤️</Text>
                <Text className="flex-1 text-base text-[#525252] dark:text-[#d4d4d4] leading-6">
                  You promise to use your success not just for yourself, but as a force for good in the lives of others.
                </Text>
              </View>
            </View>

            <Text className="text-sm text-[#737373] dark:text-[#a3a3a3] mt-4 italic text-center">
              "The best among you are those who bring the greatest benefit to others."
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
            className={`h-14 ${canAccept ? 'bg-[#171717] dark:bg-[#fafafa]' : 'bg-[#d4d4d4] dark:bg-[#404040]'}`}
          >
            <Text className={canAccept ? 'text-white dark:text-[#0a0a0a] font-semibold text-base' : 'text-[#737373] dark:text-[#737373] font-semibold text-base'}>
              {!hasScrolledToBottom
                ? 'Please read the terms above'
                : secondsRemaining > 0
                ? `Please wait ${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''}...`
                : 'I Accept & Commit to Goodness'}
            </Text>
          </Button>
        </View>
      </View>
    </>
  );
}

// Export function to check if onboarding is completed
export async function isOnboardingCompleted(): Promise<boolean> {
  const value = await storage.getItem(ONBOARDING_KEY);
  return value === 'true';
}

// Export function to reset onboarding (for testing)
export async function resetOnboarding(): Promise<void> {
  await storage.removeItem(ONBOARDING_KEY);
}
