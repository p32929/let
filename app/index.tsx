import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { Stack, router } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, ArrowUpDownIcon, BarChart3Icon, MoreVerticalIcon, CheckCircleIcon, CircleDotIcon, CircleIcon, SunIcon, MoonIcon, DownloadIcon, UploadIcon, DatabaseIcon, TrashIcon, CalendarIcon } from 'lucide-react-native';
import * as React from 'react';
import { View, ScrollView, Pressable, Platform } from 'react-native';
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
import { getEvents as dbGetEvents, deleteEvent } from '@/db/operations/events';
import { Calendar } from '@/components/ui/calendar';

export default function HomeScreen() {
  const [currentWeekDate, setCurrentWeekDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [loadingSampleData, setLoadingSampleData] = React.useState(false);
  const [loadingProgress, setLoadingProgress] = React.useState(0);
  const [loadingMessage, setLoadingMessage] = React.useState('');
  const [showMenu, setShowMenu] = React.useState(false);
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [showResetDialog, setShowResetDialog] = React.useState(false);
  const [showNoEventsDialog, setShowNoEventsDialog] = React.useState(false);
  const [showSampleDataDialog, setShowSampleDataDialog] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);
  const [importingData, setImportingData] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importMessage, setImportMessage] = React.useState('');
  const [clearExisting, setClearExisting] = React.useState(false);
  const [weekEventCompletion, setWeekEventCompletion] = React.useState<Record<string, { total: number; completed: number }>>({});
  const { events, loadEvents, isLoading } = useEventsStore();
  const { colorScheme, setColorScheme } = useColorScheme();

  // Check if any modal/dialog is showing
  const isAnyDialogShowing = loadingSampleData || isResetting || importingData ||
    showMenu || showCalendar || showImportDialog || showResetDialog ||
    showNoEventsDialog || showSampleDataDialog;

  // Memoize header right component to prevent re-creation on every render
  const headerRight = React.useCallback(() => (
    <View className="flex-row gap-1">
      <Button
        size="icon"
        variant="ghost"
        className="rounded-full"
        onPress={() => setShowMenu(!showMenu)}
        disabled={loadingSampleData || isResetting || importingData}
      >
        <Icon as={MoreVerticalIcon} className="size-5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="rounded-full"
        onPress={() => router.push('/add-event')}
        disabled={loadingSampleData || isResetting || importingData}
      >
        <Icon as={PlusIcon} className="size-5" />
      </Button>
    </View>
  ), [showMenu, loadingSampleData, isResetting, importingData]);

  // Memoize screen options
  const screenOptions = React.useMemo(() => ({
    title: 'Life Events Tracker',
    headerRight,
  }), [headerRight]);

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

  const handleLoadSampleDataConfirm = async () => {
    try {
      setShowSampleDataDialog(false);
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
      setIsResetting(true);
      const { getEvents: dbGetEvents, deleteEvent } = await import('@/db/operations/events');
      const existingEvents = await dbGetEvents();
      for (const event of existingEvents) {
        await deleteEvent(event.id);
      }
      await loadEvents();
    } catch (error) {
      console.error('Failed to reset data:', error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportData = async () => {
    try {
      setShowMenu(false);
      if (events.length === 0) {
        setShowNoEventsDialog(true);
        return;
      }
      const data = await exportData();
      await downloadExportFile(data);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const handleImportFile = async (event?: any) => {
    // For web, get the file from the event. For mobile, readImportFile handles document picking.
    const file = Platform.OS === 'web' ? event?.target?.files?.[0] : undefined;

    // For web, if no file was selected, return early
    if (Platform.OS === 'web' && !file) return;

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

  const handleCalendarDateSelect = (date: Date) => {
    setCurrentWeekDate(date);
    setSelectedDate(date);
    setShowCalendar(false);
  };

  // Swipe gesture for week navigation
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Only activate after 10px horizontal movement
    .failOffsetY([-10, 10]) // Fail if vertical movement is detected
    .onUpdate((event) => {
      // Only update if horizontal movement is greater than vertical
      if (Math.abs(event.translationX) > Math.abs(event.translationY)) {
        translateX.value = event.translationX;
        // Reduce opacity as user swipes
        opacity.value = 1 - Math.abs(event.translationX) / 400;
      }
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
      <Stack.Screen options={screenOptions} />
      <View className="flex-1 bg-white dark:bg-[#0a0a0a]">
        <View className="border-b border-[#e5e5e5] dark:border-[#262626] p-4">
          {/* Week Navigation */}
            <View className="flex-row items-center justify-between mb-4">
              <Button
                size="icon"
                variant="ghost"
                onPress={handlePreviousWeek}
                className="rounded-full"
                disabled={loadingSampleData || isResetting || importingData}
              >
                <Icon as={ChevronLeftIcon} className="size-5" />
              </Button>
              <Pressable
                onPress={() => setShowCalendar(true)}
                className="flex-1 items-center"
                disabled={loadingSampleData || isResetting || importingData}
              >
                <Text className="text-lg font-semibold text-[#0a0a0a] dark:text-[#fafafa]">
                  {formatDate(weekDays[0], 'MMM d')} - {formatDate(weekDays[6], 'MMM d, yyyy')}
                </Text>
              </Pressable>
              <Button
                size="icon"
                variant="ghost"
                onPress={handleNextWeek}
                className="rounded-full"
                disabled={loadingSampleData || isResetting || importingData}
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
                      selected ? 'bg-[#171717] dark:bg-[#fafafa]' : today ? 'bg-[#f5f5f5] dark:bg-[#262626]' : ''
                    } ${isFuture ? 'opacity-40' : ''}`}
                  >
                    <Text
                      className={`text-xs ${
                        selected ? 'text-[#fafafa] dark:text-[#171717]' : 'text-[#737373] dark:text-[#a3a3a3]'
                      }`}
                    >
                      {getDayName(day)}
                    </Text>
                    <Text
                      className={`text-lg font-semibold ${
                        selected ? 'text-[#fafafa] dark:text-[#171717]' : 'text-[#0a0a0a] dark:text-[#fafafa]'
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
        <ScrollView
            className="flex-1 p-4"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {isLoading || isResetting ? (
              <View className="gap-3">
                {/* Show 3 skeleton loaders */}
                {[1, 2, 3].map((i) => (
                  <View key={i} className="bg-card border border-border rounded-lg p-4">
                    <View className="flex-row items-center gap-3 mb-3">
                      <Skeleton className="w-1 h-16 rounded" />
                      <View className="flex-1 gap-2">
                        <Skeleton className="h-5 w-32 rounded" />
                        <Skeleton className="h-4 w-20 rounded" />
                      </View>
                    </View>
                    <Skeleton className="h-10 w-full rounded" />
                  </View>
                ))}
              </View>
            ) : events.length === 0 ? (
              <View className="items-center justify-center py-12">
                <Text className="text-center text-[#737373] dark:text-[#a3a3a3] mb-2">No events yet</Text>
                <Text className="text-center text-sm text-[#737373] dark:text-[#a3a3a3]">
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

      {/* Popup Menu */}
      {showMenu && (
        <View className="absolute top-0 left-0 right-0 bottom-0 z-50">
          <Pressable
            className="absolute inset-0 bg-transparent"
            onPress={() => setShowMenu(false)}
          />
          <View
            className="absolute bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg shadow-2xl overflow-hidden"
            style={{
              top: 12,
              right: 16,
              minWidth: 200,
              elevation: 8
            }}
          >
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-[#e5e5e5] dark:border-[#262626] hover:bg-muted/50 active:bg-[#f5f5f5] dark:active:bg-[#262626]"
              onPress={() => {
                setShowMenu(false);
                if (events.length === 0) {
                  setShowNoEventsDialog(true);
                } else {
                  router.push('/dashboard' as any);
                }
              }}
            >
              <Icon as={BarChart3Icon} className="size-5 mr-3 text-[#0a0a0a] dark:text-[#fafafa]" />
              <Text className="text-base text-[#0a0a0a] dark:text-[#fafafa]">Dashboard</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-[#e5e5e5] dark:border-[#262626] hover:bg-muted/50 active:bg-[#f5f5f5] dark:active:bg-[#262626]"
              onPress={() => {
                setShowMenu(false);
                if (events.length === 0) {
                  setShowNoEventsDialog(true);
                } else {
                  router.push('/reorder-events' as any);
                }
              }}
            >
              <Icon as={ArrowUpDownIcon} className="size-5 mr-3 text-[#0a0a0a] dark:text-[#fafafa]" />
              <Text className="text-base text-[#0a0a0a] dark:text-[#fafafa]">Reorder Events</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-[#e5e5e5] dark:border-[#262626] hover:bg-muted/50 active:bg-[#f5f5f5] dark:active:bg-[#262626]"
              onPress={handleExportData}
            >
              <Icon as={DownloadIcon} className="size-5 mr-3 text-[#0a0a0a] dark:text-[#fafafa]" />
              <Text className="text-base text-[#0a0a0a] dark:text-[#fafafa]">Export Data</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-[#e5e5e5] dark:border-[#262626] hover:bg-muted/50 active:bg-[#f5f5f5] dark:active:bg-[#262626]"
              onPress={handleOpenImportDialog}
            >
              <Icon as={UploadIcon} className="size-5 mr-3 text-[#0a0a0a] dark:text-[#fafafa]" />
              <Text className="text-base text-[#0a0a0a] dark:text-[#fafafa]">Import Data</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-[#e5e5e5] dark:border-[#262626] hover:bg-muted/50 active:bg-[#f5f5f5] dark:active:bg-[#262626]"
              onPress={() => {
                setShowMenu(false);
                setShowSampleDataDialog(true);
              }}
            >
              <Icon as={DatabaseIcon} className="size-5 mr-3 text-[#0a0a0a] dark:text-[#fafafa]" />
              <Text className="text-base text-[#0a0a0a] dark:text-[#fafafa]">Load Sample Data</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 border-b border-[#e5e5e5] dark:border-[#262626] hover:bg-muted/50 active:bg-[#f5f5f5] dark:active:bg-[#262626]"
              onPress={() => {
                setShowMenu(false);
                setShowResetDialog(true);
              }}
            >
              <Icon as={TrashIcon} className="size-5 mr-3 text-[#ef4444] dark:text-[#dc2626]" />
              <Text className="text-base text-[#ef4444] dark:text-[#dc2626]">Reset All Data</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 hover:bg-muted/50 active:bg-[#f5f5f5] dark:active:bg-[#262626]"
              onPress={() => {
                setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
              }}
            >
              <Icon as={colorScheme === 'dark' ? SunIcon : MoonIcon} className="size-5 mr-3 text-[#0a0a0a] dark:text-[#fafafa]" />
              <Text className="text-base text-[#0a0a0a] dark:text-[#fafafa]">{colorScheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* No Events Dialog */}
      {showNoEventsDialog && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4 z-[100]">
          <View className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-6 max-w-md w-full">
            <Text className="text-xl font-bold mb-2 text-[#0a0a0a] dark:text-[#fafafa]">No Events Found</Text>
            <Text className="text-[#737373] dark:text-[#a3a3a3] mb-4">
              You need to add at least one event before accessing this feature. Tap the + button to create your first event.
            </Text>
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                onPress={() => setShowNoEventsDialog(false)}
                className="flex-1"
              >
                <Text>Cancel</Text>
              </Button>
              <Button
                onPress={() => {
                  setShowNoEventsDialog(false);
                  router.push('/add-event');
                }}
                className="flex-1"
              >
                <Text>Add Event</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* Sample Data Confirmation Dialog */}
      {showSampleDataDialog && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4 z-[100]">
          <View className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-6 max-w-md w-full">
            <Text className="text-xl font-bold mb-2 text-[#0a0a0a] dark:text-[#fafafa]">Load Sample Data?</Text>
            <Text className="text-[#737373] dark:text-[#a3a3a3] mb-4">
              This will add 10 sample events with tracking data for the past year (7,300 data points). This may take a minute to complete.
            </Text>
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                onPress={() => setShowSampleDataDialog(false)}
                className="flex-1"
              >
                <Text>Cancel</Text>
              </Button>
              <Button
                onPress={handleLoadSampleDataConfirm}
                className="flex-1"
              >
                <Text>Load Sample</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4 z-[100]">
          <View className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-6 max-w-md w-full">
            <Text className="text-xl font-bold mb-2 text-[#0a0a0a] dark:text-[#fafafa]">Reset All Data?</Text>
            <Text className="text-[#737373] dark:text-[#a3a3a3] mb-4">
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
        <View className="absolute inset-0 bg-black/70 items-center justify-center p-4 z-[100]">
          <View className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-6 max-w-md w-full">
            <Text className="text-xl font-bold mb-4 text-center text-[#0a0a0a] dark:text-[#fafafa]">Loading Sample Data</Text>

            {/* Progress Bar */}
            <View className="mb-4">
              <View className="h-3 bg-[#f5f5f5] dark:bg-[#262626] rounded-full overflow-hidden">
                <View
                  className="h-full bg-[#171717] dark:bg-[#fafafa] transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </View>
            </View>

            {/* Progress Text */}
            <Text className="text-center text-[#737373] dark:text-[#a3a3a3] mb-2">
              {loadingProgress}% Complete
            </Text>
            <Text className="text-center text-sm text-[#737373] dark:text-[#a3a3a3]">
              {loadingMessage}
            </Text>

            {/* Additional Info */}
            <Text className="text-xs text-[#737373] dark:text-[#a3a3a3] text-center mt-4">
              This may take a minute... Generating 7,300 data points
            </Text>
          </View>
        </View>
      )}

      {/* Calendar Dialog */}
      {showCalendar && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4 z-[100]">
          <Pressable
            className="absolute inset-0 bg-transparent"
            onPress={() => setShowCalendar(false)}
          />
          <View className="w-full max-w-sm">
            <Calendar
              selectedDate={selectedDate}
              onSelectDate={handleCalendarDateSelect}
              onClose={() => setShowCalendar(false)}
            />
          </View>
        </View>
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4 z-[100]">
          <View className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-6 max-w-md w-full">
            <Text className="text-xl font-bold mb-2 text-[#0a0a0a] dark:text-[#fafafa]">Import Data</Text>
            <Text className="text-[#737373] dark:text-[#a3a3a3] mb-4">
              Upload a backup file to restore your events, tracking data, and settings.
            </Text>

            {!importingData ? (
              <>
                {/* Clear Existing Data Checkbox */}
                <Pressable
                  className="flex-row items-center mb-4 p-3 rounded-lg bg-[#f5f5f5]/30 dark:bg-[#262626]/30"
                  onPress={() => setClearExisting(!clearExisting)}
                >
                  <View
                    className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                      clearExisting ? 'bg-[#171717] dark:bg-[#fafafa] border-[#171717] dark:border-[#fafafa]' : 'border-[#737373] dark:border-[#a3a3a3]'
                    }`}
                  >
                    {clearExisting && (
                      <Icon as={CheckCircleIcon} className="size-3 text-[#fafafa] dark:text-[#171717]" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium text-[#0a0a0a] dark:text-[#fafafa]">Clear existing data</Text>
                    <Text className="text-xs text-[#737373] dark:text-[#a3a3a3]">
                      Delete all current events before importing
                    </Text>
                  </View>
                </Pressable>

                {/* File Input */}
                <View className="mb-4">
                  {Platform.OS === 'web' && (
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportFile}
                      style={{ display: 'none' }}
                      id="import-file-input"
                    />
                  )}
                  <Button
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        // @ts-ignore - web only
                        document.getElementById('import-file-input')?.click();
                      } else {
                        // On mobile, readImportFile will open document picker
                        handleImportFile();
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
                  <View className="h-3 bg-[#f5f5f5] dark:bg-[#262626] rounded-full overflow-hidden">
                    <View
                      className="h-full bg-[#171717] dark:bg-[#fafafa] transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </View>
                </View>

                {/* Progress Text */}
                <Text className="text-center text-[#737373] dark:text-[#a3a3a3] mb-2">
                  {importProgress}% Complete
                </Text>
                <Text className="text-center text-sm text-[#737373] dark:text-[#a3a3a3]">
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
