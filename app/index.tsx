import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, ArrowUpDownIcon, BarChart3Icon, MoreVerticalIcon, CheckCircleIcon, CircleDotIcon, CircleIcon, SunIcon, MoonIcon, DownloadIcon, UploadIcon, DatabaseIcon, TrashIcon, CalendarIcon } from 'lucide-react-native';
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
import { exportData, importData, downloadExportFile, readImportFile } from '@/lib/import-export';
import { webDb } from '@/db/client.web';

export default function HomeScreen() {
  const [currentWeekDate, setCurrentWeekDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [loadingSampleData, setLoadingSampleData] = React.useState(false);
  const [loadingProgress, setLoadingProgress] = React.useState(0);
  const [loadingMessage, setLoadingMessage] = React.useState('');
  const [showMenu, setShowMenu] = React.useState(false);
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [showResetDialog, setShowResetDialog] = React.useState(false);
  const [importingData, setImportingData] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importMessage, setImportMessage] = React.useState('');
  const [clearExisting, setClearExisting] = React.useState(false);
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
      setShowMenu(false);
      setLoadingSampleData(true);
      setLoadingProgress(0);
      setLoadingMessage('Starting...');

      await addSampleData((progress, message) => {
        setLoadingProgress(progress);
        setLoadingMessage(message);
      });

      setLoadingMessage('Loading events...');
      await loadEvents();
    } catch (error) {
      console.error('Failed to load sample data:', error);
      setLoadingMessage('Error loading sample data');
    } finally {
      setLoadingSampleData(false);
      setLoadingProgress(0);
      setLoadingMessage('');
    }
  };

  const handleResetAllData = async () => {
    try {
      setShowResetDialog(false);
      const existingEvents = await webDb.getEvents();
      for (const event of existingEvents) {
        await webDb.deleteEvent(event.id);
      }
      await loadEvents();
    } catch (error) {
      console.error('Failed to reset data:', error);
    }
  };

  const handleExportData = async () => {
    try {
      setShowMenu(false);
      const data = await exportData();
      downloadExportFile(data);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const handleImportFile = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportingData(true);
      setImportProgress(0);
      setImportMessage('Reading file...');

      const data = await readImportFile(file);

      const result = await importData(data, {
        clearExisting,
        onProgress: (progress, message) => {
          setImportProgress(progress);
          setImportMessage(message);
        },
      });

      if (result.success) {
        setImportMessage('Reloading events...');
        await loadEvents();
        setShowImportDialog(false);
        setClearExisting(false);
      } else {
        setImportMessage(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      setImportMessage('Failed to import data');
    } finally {
      setImportingData(false);
      setImportProgress(0);
      setTimeout(() => setImportMessage(''), 3000);
    }
  };

  const handleOpenImportDialog = () => {
    setShowMenu(false);
    setShowImportDialog(true);
  };

  const handleDateSelect = (dateString: string) => {
    if (!dateString) return;
    const selectedDate = new Date(dateString);
    setCurrentWeekDate(selectedDate);
    setSelectedDate(selectedDate);
  };

  const handleOpenDatePicker = () => {
    // @ts-ignore - web only
    if (typeof document !== 'undefined') {
      const input = document.getElementById('date-picker-input');
      input?.click();
    }
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
              <Pressable
                onPress={handleOpenDatePicker}
                className="flex-1 items-center"
              >
                <Text className="text-lg font-semibold">
                  {formatDate(weekDays[0], 'MMM d')} - {formatDate(weekDays[6], 'MMM d, yyyy')}
                </Text>
              </Pressable>
              {/* Hidden date input */}
              <input
                id="date-picker-input"
                type="date"
                onChange={(e) => handleDateSelect(e.target.value)}
                value={formatDate(currentWeekDate, 'yyyy-MM-dd')}
                style={{ display: 'none' }}
              />
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
        <View className="absolute top-0 left-0 right-0 bottom-0 z-50">
          <Pressable
            className="absolute inset-0 bg-transparent"
            onPress={() => setShowMenu(false)}
          />
          <View
            className="absolute bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
            style={{
              top: 12,
              right: 16,
              minWidth: 200,
              elevation: 8
            }}
          >
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-border hover:bg-muted/50 active:bg-muted"
              onPress={() => {
                setShowMenu(false);
                router.push('/dashboard' as any);
              }}
            >
              <Icon as={BarChart3Icon} className="size-5 mr-3 text-foreground" />
              <Text className="text-base text-foreground">Dashboard</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-border hover:bg-muted/50 active:bg-muted"
              onPress={() => {
                setShowMenu(false);
                router.push('/reorder-events' as any);
              }}
            >
              <Icon as={ArrowUpDownIcon} className="size-5 mr-3 text-foreground" />
              <Text className="text-base text-foreground">Reorder Events</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-border hover:bg-muted/50 active:bg-muted"
              onPress={handleExportData}
            >
              <Icon as={DownloadIcon} className="size-5 mr-3 text-foreground" />
              <Text className="text-base text-foreground">Export Data</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-border hover:bg-muted/50 active:bg-muted"
              onPress={handleOpenImportDialog}
            >
              <Icon as={UploadIcon} className="size-5 mr-3 text-foreground" />
              <Text className="text-base text-foreground">Import Data</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-border hover:bg-muted/50 active:bg-muted"
              onPress={handleLoadSampleData}
            >
              <Icon as={DatabaseIcon} className="size-5 mr-3 text-foreground" />
              <Text className="text-base text-foreground">Load Sample Data</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-border hover:bg-muted/50 active:bg-muted"
              onPress={() => {
                setShowMenu(false);
                setShowResetDialog(true);
              }}
            >
              <Icon as={TrashIcon} className="size-5 mr-3 text-destructive" />
              <Text className="text-base text-destructive">Reset All Data</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 hover:bg-muted/50 active:bg-muted"
              onPress={() => {
                setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
              }}
            >
              <Icon as={colorScheme === 'dark' ? SunIcon : MoonIcon} className="size-5 mr-3 text-foreground" />
              <Text className="text-base text-foreground">{colorScheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4 z-50">
          <View className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <Text className="text-xl font-bold mb-2">Reset All Data?</Text>
            <Text className="text-muted-foreground mb-4">
              This will permanently delete all events and tracking data. This action cannot be undone.
            </Text>
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                onPress={() => setShowResetDialog(false)}
                className="flex-1"
              >
                <Text>Cancel</Text>
              </Button>
              <Button
                variant="destructive"
                onPress={handleResetAllData}
                className="flex-1"
              >
                <Text>Reset All</Text>
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

      {/* Import Dialog */}
      {showImportDialog && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4 z-50">
          <View className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <Text className="text-xl font-bold mb-2">Import Data</Text>
            <Text className="text-muted-foreground mb-4">
              Upload a backup file to restore your events, tracking data, and settings.
            </Text>

            {!importingData ? (
              <>
                {/* Clear Existing Data Checkbox */}
                <Pressable
                  className="flex-row items-center mb-4 p-3 rounded-lg bg-muted/30"
                  onPress={() => setClearExisting(!clearExisting)}
                >
                  <View
                    className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                      clearExisting ? 'bg-primary border-primary' : 'border-muted-foreground'
                    }`}
                  >
                    {clearExisting && (
                      <Icon as={CheckCircleIcon} className="size-3 text-primary-foreground" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium">Clear existing data</Text>
                    <Text className="text-xs text-muted-foreground">
                      Delete all current events before importing
                    </Text>
                  </View>
                </Pressable>

                {/* File Input */}
                <View className="mb-4">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    style={{ display: 'none' }}
                    id="import-file-input"
                  />
                  <Button
                    onPress={() => {
                      // @ts-ignore - web only
                      if (typeof document !== 'undefined') {
                        document.getElementById('import-file-input')?.click();
                      }
                    }}
                    className="w-full"
                  >
                    <Icon as={UploadIcon} className="size-4 mr-2" />
                    <Text>Choose File</Text>
                  </Button>
                </View>

                <Button
                  variant="outline"
                  onPress={() => {
                    setShowImportDialog(false);
                    setClearExisting(false);
                  }}
                  className="w-full"
                >
                  <Text>Cancel</Text>
                </Button>
              </>
            ) : (
              <>
                {/* Progress Bar */}
                <View className="mb-4">
                  <View className="h-3 bg-muted rounded-full overflow-hidden">
                    <View
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </View>
                </View>

                {/* Progress Text */}
                <Text className="text-center text-muted-foreground mb-2">
                  {importProgress}% Complete
                </Text>
                <Text className="text-center text-sm text-muted-foreground">
                  {importMessage}
                </Text>
              </>
            )}
          </View>
        </View>
      )}
    </>
  );
}
