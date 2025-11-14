import { Text } from '@/components/ui/text';
import { Stack } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Dimensions } from 'react-native';
import { useEventsStore } from '@/lib/stores/events-store';
import { getEventValuesForDateRange } from '@/db/operations/events';
import { format, subDays } from 'date-fns';
// @ts-ignore - No types available
import { LineChart } from 'react-native-svg-charts';
// @ts-ignore - No types available
import * as shape from 'd3-shape';
import type { Event } from '@/types/events';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const { events } = useEventsStore();
  const [eventData, setEventData] = React.useState<Record<number, any[]>>({});
  const [isLoading, setIsLoading] = React.useState(true);

  // Load last 30 days of data for all events
  React.useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const endDate = new Date();
        const startDate = subDays(endDate, 30);
        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');

        const dataPromises = events.map(async (event) => {
          const values = await getEventValuesForDateRange(event.id, startStr, endStr);
          return { eventId: event.id, values };
        });

        const results = await Promise.all(dataPromises);
        const dataMap: Record<number, any[]> = {};
        results.forEach(({ eventId, values }) => {
          dataMap[eventId] = values;
        });

        setEventData(dataMap);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (events.length > 0) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [events]);

  const getChartData = (event: Event) => {
    const values = eventData[event.id] || [];
    if (event.type === 'string') return null; // Skip string events for now

    return values
      .map((v) => (event.type === 'boolean' ? (v.value === 'true' ? 1 : 0) : parseFloat(v.value) || 0))
      .filter((v) => !isNaN(v));
  };

  const renderEventChart = (event: Event) => {
    const chartData = getChartData(event);
    if (!chartData || chartData.length === 0) return null;

    const max = Math.max(...chartData);
    const min = Math.min(...chartData);
    const avg = chartData.reduce((a, b) => a + b, 0) / chartData.length;

    return (
      <View
        key={event.id}
        className="bg-card border border-border rounded-lg p-4 mb-4"
        style={{ borderLeftWidth: 4, borderLeftColor: event.color }}
      >
        <Text className="font-semibold text-base mb-2">{event.name}</Text>
        <Text className="text-sm text-muted-foreground mb-3">
          {event.type === 'boolean'
            ? 'Yes/No'
            : `Number${event.unit ? ` (${event.unit})` : ''}`}
        </Text>

        <LineChart
          style={{ height: 150, width: screenWidth - 64 }}
          data={chartData}
          svg={{ stroke: event.color, strokeWidth: 2 }}
          contentInset={{ top: 20, bottom: 20 }}
          curve={shape.curveNatural}
        />

        <View className="mt-3 flex-row justify-between">
          <View>
            <Text className="text-xs text-muted-foreground">Avg</Text>
            <Text className="font-semibold">{avg.toFixed(1)}</Text>
          </View>
          <View>
            <Text className="text-xs text-muted-foreground">Min</Text>
            <Text className="font-semibold">{min.toFixed(1)}</Text>
          </View>
          <View>
            <Text className="text-xs text-muted-foreground">Max</Text>
            <Text className="font-semibold">{max.toFixed(1)}</Text>
          </View>
          <View>
            <Text className="text-xs text-muted-foreground">Entries</Text>
            <Text className="font-semibold">{chartData.length}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Dashboard',
        }}
      />
      <ScrollView className="flex-1 bg-background p-4">
        {isLoading ? (
          <View className="items-center justify-center py-12">
            <Text className="text-muted-foreground">Loading dashboard...</Text>
          </View>
        ) : events.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-center text-muted-foreground mb-2">No events yet</Text>
            <Text className="text-center text-sm text-muted-foreground">
              Create events to see trends and insights
            </Text>
          </View>
        ) : (
          <View>
            <Text className="text-2xl font-bold mb-1">Trends & Insights</Text>
            <Text className="text-muted-foreground mb-6">Last 30 days of data</Text>

            {events.filter((e) => e.type !== 'string').map(renderEventChart)}

            {events.filter((e) => e.type === 'string').length > 0 && (
              <View className="bg-muted rounded-lg p-4">
                <Text className="text-sm text-muted-foreground">
                  Text events are not shown in charts. View individual entries in the weekly view.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}
