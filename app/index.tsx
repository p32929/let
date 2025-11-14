import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react-native';
import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useEventsStore } from '@/lib/stores/events-store';
import { getWeekDays, formatDate, isToday, getNextWeek, getPreviousWeek, getDayName } from '@/lib/date-utils';
import { migrateDatabase } from '@/db/migrate';
import { EventTracker } from '@/components/event-tracker';

export default function HomeScreen() {
  const [currentWeekDate, setCurrentWeekDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const { events, loadEvents, isLoading } = useEventsStore();

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

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Life Events Tracker',
          headerRight: () => (
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full"
              onPress={() => router.push('/add-event')}
            >
              <Icon as={PlusIcon} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="flex-1 bg-background">
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
      </View>
    </>
  );
}
