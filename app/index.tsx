import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, ArrowUpDownIcon, BarChart3Icon } from 'lucide-react-native';
import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { useEventsStore } from '@/lib/stores/events-store';
import { getWeekDays, formatDate, isToday, getNextWeek, getPreviousWeek, getDayName } from '@/lib/date-utils';
import { migrateDatabase } from '@/db/migrate';
import { EventTracker } from '@/components/event-tracker';
import { addSampleData } from '@/lib/sample-data';

export default function HomeScreen() {
  const [currentWeekDate, setCurrentWeekDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [loadingSampleData, setLoadingSampleData] = React.useState(false);
  const [showSampleDataPrompt, setShowSampleDataPrompt] = React.useState(false);
  const { events, loadEvents, isLoading } = useEventsStore();

  // Animated values for swipe gestures
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    // Initialize database and load events
    const init = async () => {
      try {
        await migrateDatabase();
        await loadEvents();
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };
    init();
  }, []);

  // Show sample data prompt on first visit
  React.useEffect(() => {
    const checkFirstVisit = () => {
      const hasSeenBefore = localStorage.getItem('life-events-tracker-initialized');

      if (!hasSeenBefore && !isLoading && events.length === 0) {
        setShowSampleDataPrompt(true);
      }
    };

    checkFirstVisit();
  }, [events.length, isLoading]);

  const weekDays = React.useMemo(() => getWeekDays(currentWeekDate), [currentWeekDate]);

  const handlePreviousWeek = () => {
    setCurrentWeekDate(getPreviousWeek(currentWeekDate));
  };

  const handleNextWeek = () => {
    setCurrentWeekDate(getNextWeek(currentWeekDate));
  };

  const handleDaySelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleLoadSampleData = async () => {
    try {
      setLoadingSampleData(true);
      setShowSampleDataPrompt(false);
      await addSampleData();
      await loadEvents();
      localStorage.setItem('life-events-tracker-initialized', 'true');
    } catch (error) {
      console.error('Failed to load sample data:', error);
    } finally {
      setLoadingSampleData(false);
    }
  };

  const handleDismissSampleDataPrompt = () => {
    setShowSampleDataPrompt(false);
    localStorage.setItem('life-events-tracker-initialized', 'true');
  };

  // Swipe gesture for week navigation
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      // Reduce opacity as user swipes
      opacity.value = 1 - Math.abs(event.translationX) / 400;
    })
    .onEnd((event) => {
      const threshold = 50; // Minimum swipe distance

      if (event.translationX > threshold) {
        // Swipe right - go to previous week
        runOnJS(handlePreviousWeek)();
      } else if (event.translationX < -threshold) {
        // Swipe left - go to next week
        runOnJS(handleNextWeek)();
      }

      // Reset animation
      translateX.value = withSpring(0);
      opacity.value = withSpring(1);
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      opacity: opacity.value,
    };
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Life Events Tracker',
          headerRight: () => (
            <View className="flex-row gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                onPress={() => router.push('/dashboard' as any)}
              >
                <Icon as={BarChart3Icon} className="size-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                onPress={() => router.push('/reorder-events' as any)}
              >
                <Icon as={ArrowUpDownIcon} className="size-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                onPress={() => router.push('/add-event')}
              >
                <Icon as={PlusIcon} className="size-5" />
              </Button>
            </View>
          ),
        }}
      />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]} className="bg-background">
          {/* Week Navigation */}
          <View className="border-b border-border p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Button
                size="icon"
                variant="ghost"
                onPress={handlePreviousWeek}
                className="rounded-full"
              >
                <Icon as={ChevronLeftIcon} className="size-5" />
              </Button>
              <Text className="text-lg font-semibold">
                {formatDate(weekDays[0], 'MMM d')} - {formatDate(weekDays[6], 'MMM d, yyyy')}
              </Text>
              <Button
                size="icon"
                variant="ghost"
                onPress={handleNextWeek}
                className="rounded-full"
              >
                <Icon as={ChevronRightIcon} className="size-5" />
              </Button>
            </View>

            {/* Week Days */}
            <View className="flex-row justify-between">
              {weekDays.map((day) => {
                const selected = formatDate(day) === formatDate(selectedDate);
                const today = isToday(day);

                return (
                  <Pressable
                    key={formatDate(day)}
                    onPress={() => handleDaySelect(day)}
                    className={`items-center justify-center rounded-lg p-2 flex-1 mx-0.5 ${
                      selected ? 'bg-primary' : today ? 'bg-muted' : ''
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        selected ? 'text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {getDayName(day)}
                    </Text>
                    <Text
                      className={`text-lg font-semibold ${
                        selected ? 'text-primary-foreground' : today ? 'text-foreground' : 'text-foreground'
                      }`}
                    >
                      {formatDate(day, 'd')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Events List */}
          <ScrollView className="flex-1 p-4">
            {isLoading ? (
              <View className="items-center justify-center py-8">
                <Text className="text-muted-foreground">Loading events...</Text>
              </View>
            ) : events.length === 0 ? (
              <View className="items-center justify-center py-12">
                <Text className="text-center text-muted-foreground mb-2">No events yet</Text>
                <Text className="text-center text-sm text-muted-foreground">
                  Tap the + button to create your first event
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {events.map((event) => (
                  <EventTracker key={event.id} event={event} date={selectedDate} />
                ))}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </GestureDetector>

      {/* Sample Data Prompt Dialog */}
      {showSampleDataPrompt && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4">
          <View className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <Text className="text-xl font-bold mb-2">Welcome! 👋</Text>
            <Text className="text-muted-foreground mb-4">
              Would you like to load sample data to see how the app works? This will create 4
              events with 30 days of tracking data to demonstrate pattern insights.
            </Text>
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                onPress={handleDismissSampleDataPrompt}
                className="flex-1"
              >
                <Text>No, Start Fresh</Text>
              </Button>
              <Button onPress={handleLoadSampleData} disabled={loadingSampleData} className="flex-1">
                <Text>{loadingSampleData ? 'Loading...' : 'Yes, Load Sample'}</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </>
  );
}
