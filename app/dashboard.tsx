import { Text } from '@/components/ui/text';
import { Stack } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Dimensions } from 'react-native';
import { useEventsStore } from '@/lib/stores/events-store';
import { getEventValuesForDateRange } from '@/db/operations/events';
import { format, subDays, parseISO } from 'date-fns';
// @ts-ignore - No types available
import { LineChart } from 'react-native-svg-charts';
// @ts-ignore - No types available
import * as shape from 'd3-shape';
import type { Event } from '@/types/events';

const screenWidth = Dimensions.get('window').width;

interface EventDataPoint {
  date: string;
  value: number;
}

interface CorrelationInsight {
  event1: Event;
  event2: Event;
  correlation: number;
  insight: string;
}

export default function DashboardScreen() {
  const { events } = useEventsStore();
  const [eventData, setEventData] = React.useState<Record<number, EventDataPoint[]>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [correlations, setCorrelations] = React.useState<CorrelationInsight[]>([]);

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
          const dataPoints: EventDataPoint[] = values.map((v) => ({
            date: v.date,
            value: event.type === 'boolean' ? (v.value === 'true' ? 1 : 0) : parseFloat(v.value) || 0,
          }));
          return { eventId: event.id, dataPoints };
        });

        const results = await Promise.all(dataPromises);
        const dataMap: Record<number, EventDataPoint[]> = {};
        results.forEach(({ eventId, dataPoints }) => {
          dataMap[eventId] = dataPoints;
        });

        setEventData(dataMap);

        // Calculate correlations
        const insights = calculateCorrelations(events, dataMap);
        setCorrelations(insights);
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

  const calculateCorrelations = (
    allEvents: Event[],
    dataMap: Record<number, EventDataPoint[]>
  ): CorrelationInsight[] => {
    const insights: CorrelationInsight[] = [];
    const numericEvents = allEvents.filter((e) => e.type !== 'string');

    // Compare each pair of events
    for (let i = 0; i < numericEvents.length; i++) {
      for (let j = i + 1; j < numericEvents.length; j++) {
        const event1 = numericEvents[i];
        const event2 = numericEvents[j];
        const data1 = dataMap[event1.id] || [];
        const data2 = dataMap[event2.id] || [];

        if (data1.length < 3 || data2.length < 3) continue;

        // Find common dates
        const commonDates = data1
          .map((d) => d.date)
          .filter((date) => data2.some((d2) => d2.date === date));

        if (commonDates.length < 3) continue;

        // Get values for common dates
        const values1 = commonDates.map((date) => data1.find((d) => d.date === date)!.value);
        const values2 = commonDates.map((date) => data2.find((d) => d.date === date)!.value);

        // Calculate correlation coefficient
        const correlation = calculatePearsonCorrelation(values1, values2);

        if (Math.abs(correlation) > 0.5) {
          // Strong correlation
          const insight = generateInsight(event1, event2, correlation, values1, values2);
          insights.push({ event1, event2, correlation, insight });
        }
      }
    }

    return insights.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  };

  const calculatePearsonCorrelation = (x: number[], y: number[]): number => {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  };

  const generateInsight = (
    event1: Event,
    event2: Event,
    correlation: number,
    values1: number[],
    values2: number[]
  ): string => {
    const avg1 = values1.reduce((a, b) => a + b, 0) / values1.length;
    const avg2 = values2.reduce((a, b) => a + b, 0) / values2.length;

    const unit1 = event1.unit ? ` ${event1.unit}` : '';
    const unit2 = event2.unit ? ` ${event2.unit}` : '';

    if (correlation > 0.5) {
      return `When ${event1.name} is high (avg ${avg1.toFixed(1)}${unit1}), ${event2.name} tends to be high (avg ${avg2.toFixed(1)}${unit2})`;
    } else {
      return `When ${event1.name} is high (avg ${avg1.toFixed(1)}${unit1}), ${event2.name} tends to be low (avg ${avg2.toFixed(1)}${unit2})`;
    }
  };

  const getChartData = (event: Event) => {
    const data = eventData[event.id] || [];
    if (event.type === 'string' || data.length === 0) return null;
    return data.map((d) => d.value);
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
          {event.type === 'boolean' ? 'Yes/No' : `Number${event.unit ? ` (${event.unit})` : ''}`}
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
          title: 'Dashboard & Insights',
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
            {/* Correlation Insights Section */}
            {correlations.length > 0 && (
              <View className="mb-6">
                <Text className="text-2xl font-bold mb-1">💡 Insights</Text>
                <Text className="text-muted-foreground mb-4">
                  Patterns and correlations in your data
                </Text>

                {correlations.map((insight, index) => (
                  <View
                    key={`${insight.event1.id}-${insight.event2.id}`}
                    className="bg-card border border-border rounded-lg p-4 mb-3"
                  >
                    <View className="flex-row items-center mb-2">
                      <View
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: insight.event1.color }}
                      />
                      <Text className="font-semibold">{insight.event1.name}</Text>
                      <Text className="mx-2 text-muted-foreground">×</Text>
                      <View
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: insight.event2.color }}
                      />
                      <Text className="font-semibold">{insight.event2.name}</Text>
                    </View>

                    <Text className="text-sm mb-2">{insight.insight}</Text>

                    <View className="flex-row items-center">
                      <Text className="text-xs text-muted-foreground">Correlation: </Text>
                      <Text
                        className={`text-xs font-semibold ${
                          insight.correlation > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {(insight.correlation * 100).toFixed(0)}%{' '}
                        {insight.correlation > 0 ? 'Positive' : 'Negative'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Trends Section */}
            <View>
              <Text className="text-2xl font-bold mb-1">📊 Trends</Text>
              <Text className="text-muted-foreground mb-4">Last 30 days of data</Text>

              {events.filter((e) => e.type !== 'string').map(renderEventChart)}

              {events.filter((e) => e.type === 'string').length > 0 && (
                <View className="bg-muted rounded-lg p-4">
                  <Text className="text-sm text-muted-foreground">
                    Text events are not shown in charts. View individual entries in the weekly
                    view.
                  </Text>
                </View>
              )}

              {events.filter((e) => e.type !== 'string').length === 0 && (
                <View className="bg-muted rounded-lg p-4">
                  <Text className="text-sm text-muted-foreground">
                    Add numeric or boolean events to see trend charts
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}
