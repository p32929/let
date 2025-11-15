import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, ArrowUpDownIcon, BarChart3Icon, MoreVerticalIcon, CheckCircleIcon, CircleDotIcon, CircleIcon, SunIcon, MoonIcon } from 'lucide-react-native';
import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { useEventsStore } from '@/lib/stores/events-store';
import { getWeekDays, formatDate, isToday, getNextWeek, getPreviousWeek, getDayName } from '@/lib/date-utils';
import { migrateDatabase } from '@/db/migrate';
import { EventTracker } from '@/components/event-tracker';
import { addSampleData } from '@/lib/sample-data';
import { getEventValuesForDateRange } from '@/db/operations/events';

export default function HomeScreen() {
  const [currentWeekDate, setCurrentWeekDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [loadingSampleData, setLoadingSampleData] = React.useState(false);
  const [loadingProgress, setLoadingProgress] = React.useState(0);
  const [loadingMessage, setLoadingMessage] = React.useState('');
  const [showSampleDataPrompt, setShowSampleDataPrompt] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [weekEventCompletion, setWeekEventCompletion] = React.useState<Record<string, { total: number; completed: number }>>({});
  const { events, loadEvents, isLoading } = useEventsStore();
  const { colorScheme, setColorScheme } = useColorScheme();

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

  // Load event completion for each day of the week
  React.useEffect(() => {
    const loadWeekCompletion = async () => {
      if (events.length === 0) {
        setWeekEventCompletion({});
        return;
      }

      const completion: Record<string, { total: number; completed: number }> = {};

      for (const day of weekDays) {
        const dateStr = formatDate(day);
        let completed = 0;

        for (const event of events) {
          const values = await getEventValuesForDateRange(event.id, dateStr, dateStr);
          if (values.length > 0 && values[0].value) {
            // Count as completed if has any value (for booleans, strings, or numbers)
            if (event.type === 'boolean') {
              if (values[0].value === 'true') completed++;
            } else if (event.type === 'number') {
              if (values[0].value && parseFloat(values[0].value) > 0) completed++;
            } else {
              if (values[0].value.trim() !== '') completed++;
            }
          }
        }

        completion[dateStr] = { total: events.length, completed };
      }

      setWeekEventCompletion(completion);
    };

    loadWeekCompletion();
  }, [weekDays, events]);

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
      setLoadingProgress(0);
      setLoadingMessage('Starting...');
      setShowSampleDataPrompt(false);

      await addSampleData((progress, message) => {
        setLoadingProgress(progress);
        setLoadingMessage(message);
      });

      setLoadingMessage('Loading events...');
      await loadEvents();
      localStorage.setItem('life-events-tracker-initialized', 'true');
    } catch (error) {
      console.error('Failed to load sample data:', error);
      setLoadingMessage('Error loading sample data');
    } finally {
      setLoadingSampleData(false);
      setLoadingProgress(0);
      setLoadingMessage('');
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
                onPress={() => setShowMenu(!showMenu)}
              >
                <Icon as={MoreVerticalIcon} className="size-5" />
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
                const isFuture = day > new Date();
                const dateStr = formatDate(day);
                const completion = weekEventCompletion[dateStr];
                const completionPercent = completion ? (completion.completed / completion.total) * 100 : 0;

                return (
                  <Pressable
                    key={formatDate(day)}
                    onPress={() => !isFuture && handleDaySelect(day)}
                    disabled={isFuture}
                    className={`items-center justify-center rounded-lg p-2 flex-1 mx-0.5 relative ${
                      selected ? 'bg-primary' : today ? 'bg-muted' : ''
                    } ${isFuture ? 'opacity-40' : ''}`}
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
                    {/* Completion indicator */}
                    {completion && completion.total > 0 && (
                      <View className="mt-1">
                        {completionPercent === 100 ? (
                          <View className={`w-4 h-4 rounded-full items-center justify-center ${selected ? 'bg-primary-foreground' : 'bg-green-500'}`}>
                            <Text className={`text-[10px] font-bold ${selected ? 'text-primary' : 'text-white'}`}>✓</Text>
                          </View>
                        ) : completionPercent > 0 ? (
                          <View className="items-center">
                            <Text className={`text-[9px] font-medium ${selected ? 'text-primary-foreground' : 'text-orange-500'}`}>
                              {completion.completed}/{completion.total}
                            </Text>
                          </View>
                        ) : (
                          <View className={`w-3 h-3 rounded-full border-2 ${selected ? 'border-primary-foreground/50' : 'border-muted-foreground/30'}`} />
                        )}
                      </View>
                    )}
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

      {/* Popup Menu */}
      {showMenu && (
        <>
          <Pressable
            className="absolute inset-0 bg-transparent z-40"
            onPress={() => setShowMenu(false)}
          />
          <View className="absolute top-16 right-4 bg-card border border-border rounded-lg shadow-lg min-w-[200px] overflow-hidden z-50">
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-border active:bg-muted"
              onPress={() => {
                setShowMenu(false);
                router.push('/dashboard' as any);
              }}
            >
              <Icon as={BarChart3Icon} className="size-5 mr-3 text-foreground" />
              <Text className="text-base">Dashboard</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-border active:bg-muted"
              onPress={() => {
                setShowMenu(false);
                router.push('/reorder-events' as any);
              }}
            >
              <Icon as={ArrowUpDownIcon} className="size-5 mr-3 text-foreground" />
              <Text className="text-base">Reorder Events</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 active:bg-muted"
              onPress={() => {
                setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
              }}
            >
              <Icon as={colorScheme === 'dark' ? SunIcon : MoonIcon} className="size-5 mr-3 text-foreground" />
              <Text className="text-base">{colorScheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Sample Data Prompt Dialog */}
      {showSampleDataPrompt && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4">
          <View className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <Text className="text-xl font-bold mb-2">Welcome! 👋</Text>
            <Text className="text-muted-foreground mb-4">
              Would you like to load sample data to see how the app works? This will create 10
              events with 2 years of tracking data to demonstrate pattern insights.
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

      {/* Loading Progress Overlay */}
      {loadingSampleData && (
        <View className="absolute inset-0 bg-black/70 items-center justify-center p-4">
          <View className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <Text className="text-xl font-bold mb-4 text-center">Loading Sample Data</Text>

            {/* Progress Bar */}
            <View className="mb-4">
              <View className="h-3 bg-muted rounded-full overflow-hidden">
                <View
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </View>
            </View>

            {/* Progress Text */}
            <Text className="text-center text-muted-foreground mb-2">
              {loadingProgress}% Complete
            </Text>
            <Text className="text-center text-sm text-muted-foreground">
              {loadingMessage}
            </Text>

            {/* Additional Info */}
            <Text className="text-xs text-muted-foreground text-center mt-4">
              This may take a minute... Generating 7,300 data points
            </Text>
          </View>
        </View>
      )}
    </>
  );
}
