import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Stack } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Dimensions } from 'react-native';
import { useEventsStore } from '@/lib/stores/events-store';
import { getEventValuesForDateRange } from '@/db/operations/events';
import { format, subDays, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Event } from '@/types/events';

const screenWidth = Dimensions.get('window').width;

interface EventDataPoint {
  date: string;
  value: number;
}

interface Pattern {
  description: string;
  confidence: number; // 0-100%
  type: 'threshold' | 'co-occurrence' | 'sequence';
  events: Event[];
}

type TimeRange = '7d' | '30d' | '90d' | '365d';

export default function DashboardScreen() {
  const { events } = useEventsStore();
  const [patterns, setPatterns] = React.useState<Pattern[]>([]);
  const [eventData, setEventData] = React.useState<{ event: Event; dataPoints: EventDataPoint[] }[]>([]);
  const [chartData, setChartData] = React.useState<{ event: Event; dataPoints: EventDataPoint[] }[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<TimeRange>('30d');

  const getDaysForRange = (range: TimeRange): number => {
    switch (range) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '365d': return 365;
    }
  };

  // Load ALL data once for pattern detection
  React.useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      try {
        const endDate = new Date();
        const startDate = subDays(endDate, 730); // Always load 2 years for patterns
        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');

        // Load all data for pattern detection
        const dataPromises = events.map(async (event) => {
          const values = await getEventValuesForDateRange(event.id, startStr, endStr);
          const dataPoints: EventDataPoint[] = values.map((v) => ({
            date: v.date,
            value: event.type === 'boolean' ? (v.value === 'true' ? 1 : 0) : parseFloat(v.value) || 0,
          }));
          return { event, dataPoints };
        });

        const allData = await Promise.all(dataPromises);
        setEventData(allData);

        // Discover patterns from ALL data
        const discoveredPatterns = discoverPatterns(allData);
        setPatterns(discoveredPatterns);
      } catch (error) {
        console.error('Failed to analyze patterns:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (events.length > 0) {
      loadAllData();
    } else {
      setIsLoading(false);
    }
  }, [events]);

  // Filter chart data based on selected time range
  React.useEffect(() => {
    if (eventData.length === 0) {
      setChartData([]);
      return;
    }

    const days = getDaysForRange(timeRange);
    const cutoffDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

    const filteredChartData = eventData.map(({ event, dataPoints }) => ({
      event,
      dataPoints: dataPoints.filter((point) => point.date >= cutoffDate),
    }));

    setChartData(filteredChartData);
  }, [eventData, timeRange]);

  const discoverPatterns = (
    allData: { event: Event; dataPoints: EventDataPoint[] }[]
  ): Pattern[] => {
    const patterns: Pattern[] = [];
    const numericEvents = allData.filter((d) => d.event.type !== 'string');

    if (numericEvents.length < 2) return patterns;

    // 1. THRESHOLD PATTERNS: "When X > threshold, Y happens"
    for (const { event: event1, dataPoints: data1 } of numericEvents) {
      if (data1.length < 5) continue;

      // Find meaningful thresholds
      const values = data1.map((d) => d.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const thresholds = event1.type === 'boolean' ? [0.5] : [avg, avg * 0.7, avg * 1.3];

      for (const threshold of thresholds) {
        for (const { event: event2, dataPoints: data2 } of numericEvents) {
          if (event1.id === event2.id || data2.length < 5) continue;

          const pattern = analyzeThresholdPattern(
            event1,
            data1,
            threshold,
            event2,
            data2
          );
          if (pattern) patterns.push(pattern);
        }
      }
    }

    // 2. CO-OCCURRENCE PATTERNS: "When X happens, Y happens N% of the time"
    for (let i = 0; i < numericEvents.length; i++) {
      for (let j = i + 1; j < numericEvents.length; j++) {
        const { event: event1, dataPoints: data1 } = numericEvents[i];
        const { event: event2, dataPoints: data2 } = numericEvents[j];

        const pattern = analyzeCoOccurrence(event1, data1, event2, data2);
        if (pattern) patterns.push(pattern);
      }
    }

    // Sort by confidence and return top patterns
    return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  };

  const analyzeThresholdPattern = (
    event1: Event,
    data1: EventDataPoint[],
    threshold: number,
    event2: Event,
    data2: EventDataPoint[]
  ): Pattern | null => {
    // Find common dates
    const commonDates = data1
      .map((d) => d.date)
      .filter((date) => data2.some((d2) => d2.date === date));

    if (commonDates.length < 5) return null;

    // Split into above/below threshold
    const aboveThreshold = commonDates.filter((date) => {
      const val = data1.find((d) => d.date === date)!.value;
      return val > threshold;
    });

    const belowThreshold = commonDates.filter((date) => {
      const val = data1.find((d) => d.date === date)!.value;
      return val <= threshold;
    });

    if (aboveThreshold.length < 3 || belowThreshold.length < 3) return null;

    // Calculate event2 averages
    const avgWhenAbove =
      aboveThreshold.reduce((sum, date) => {
        return sum + data2.find((d) => d.date === date)!.value;
      }, 0) / aboveThreshold.length;

    const avgWhenBelow =
      belowThreshold.reduce((sum, date) => {
        return sum + data2.find((d) => d.date === date)!.value;
      }, 0) / belowThreshold.length;

    // Calculate difference and confidence
    const difference = Math.abs(avgWhenAbove - avgWhenBelow);
    const avgValue = data2.map((d) => d.value).reduce((a, b) => a + b, 0) / data2.length;
    const percentDiff = (difference / avgValue) * 100;

    if (percentDiff < 20) return null; // Less than 20% difference is not meaningful

    const confidence = Math.min(95, percentDiff);
    const unit1 = event1.unit ? ` ${event1.unit}` : '';
    const unit2 = event2.unit ? ` ${event2.unit}` : '';

    const thresholdStr =
      event1.type === 'boolean' ? 'happens' : `> ${threshold.toFixed(1)}${unit1}`;
    const direction = avgWhenAbove > avgWhenBelow ? 'higher' : 'lower';

    return {
      description: `When ${event1.name} ${thresholdStr}, ${event2.name} is ${direction} (${avgWhenAbove.toFixed(1)}${unit2} vs ${avgWhenBelow.toFixed(1)}${unit2})`,
      confidence: Math.round(confidence),
      type: 'threshold',
      events: [event1, event2],
    };
  };

  const analyzeCoOccurrence = (
    event1: Event,
    data1: EventDataPoint[],
    event2: Event,
    data2: EventDataPoint[]
  ): Pattern | null => {
    // Find common dates
    const commonDates = data1
      .map((d) => d.date)
      .filter((date) => data2.some((d2) => d2.date === date));

    if (commonDates.length < 5) return null;

    // For boolean events, check co-occurrence
    if (event1.type === 'boolean' || event2.type === 'boolean') {
      const event1Happens = commonDates.filter((date) => {
        const val = data1.find((d) => d.date === date)!.value;
        return val > 0.5;
      });

      const bothHappen = event1Happens.filter((date) => {
        const val = data2.find((d) => d.date === date)!.value;
        return val > 0.5;
      });

      if (event1Happens.length < 3) return null;

      const coOccurrenceRate = (bothHappen.length / event1Happens.length) * 100;

      if (coOccurrenceRate < 60 && coOccurrenceRate > 40) return null; // Not meaningful

      return {
        description: `When ${event1.name} happens, ${event2.name} happens ${coOccurrenceRate.toFixed(0)}% of the time`,
        confidence: Math.round(Math.abs(coOccurrenceRate - 50) + 50),
        type: 'co-occurrence',
        events: [event1, event2],
      };
    }

    return null;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High confidence';
    if (confidence >= 60) return 'Medium confidence';
    return 'Low confidence';
  };

  const renderCombinedChart = () => {
    if (chartData.length === 0) return null;

    // Filter out string events and get numeric ones
    const numericEvents = chartData.filter((d) => d.event.type !== 'string' && d.dataPoints.length > 0);

    if (numericEvents.length === 0) return null;

    // Get all unique dates
    const allDates = Array.from(
      new Set(numericEvents.flatMap((d) => d.dataPoints.map((p) => p.date)))
    ).sort();

    // Create chart data with all events combined
    const combinedChartData = allDates.map((date) => {
      const dataPoint: any = {
        date: format(parseISO(date), 'MMM d'),
        fullDate: date,
      };

      numericEvents.forEach(({ event, dataPoints }) => {
        const point = dataPoints.find((p) => p.date === date);
        if (point) {
          // Normalize to 0-100 scale
          const values = dataPoints.map((d) => d.value);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min || 1;
          const normalized = ((point.value - min) / range) * 100;

          dataPoint[event.name] = normalized;
          dataPoint[`${event.name}_original`] = point.value;
        }
      });

      return dataPoint;
    });

    // Calculate chart width based on number of data points for scrolling
    const dataPointsCount = combinedChartData.length;
    const minChartWidth = screenWidth - 64; // Account for padding
    const chartWidth = Math.max(minChartWidth, dataPointsCount * 3); // 3px per data point minimum

    return (
      <View className="bg-card border border-border rounded-lg p-4 mb-4">
        <Text className="font-semibold text-lg mb-2">All Events Combined</Text>
        <Text className="text-sm text-muted-foreground mb-4">
          Normalized view to see patterns (scrollable)
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={true} className="mb-2">
          <View style={{ width: chartWidth, height: 300 }}>
            <ResponsiveContainer width={chartWidth} height={300}>
              <LineChart data={combinedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="date"
                  stroke="#999"
                  tick={{ fill: '#999', fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  stroke="#999"
                  tick={{ fill: '#999', fontSize: 12 }}
                  label={{ value: 'Normalized %', angle: -90, position: 'insideLeft', fill: '#999' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: '#999' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ color: '#999' }} />
                {numericEvents.map(({ event }) => (
                  <Line
                    key={event.id}
                    type="monotone"
                    dataKey={event.name}
                    stroke={event.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </View>
        </ScrollView>

        <Text className="text-xs text-muted-foreground mt-3">
          * Values normalized to 0-100% scale for visual comparison. Scroll horizontally to see all data points!
        </Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Patterns & Insights',
        }}
      />
      <ScrollView className="flex-1 bg-background p-4">
        {isLoading ? (
          <View className="items-center justify-center py-12">
            <Text className="text-muted-foreground">Analyzing patterns...</Text>
          </View>
        ) : events.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-center text-muted-foreground mb-2">No events yet</Text>
            <Text className="text-center text-sm text-muted-foreground">
              Create events and track data to discover patterns
            </Text>
          </View>
        ) : eventData.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-center text-muted-foreground mb-2">
              Not enough data yet
            </Text>
            <Text className="text-center text-sm text-muted-foreground">
              Track events for a few more days to see trends
            </Text>
          </View>
        ) : (
          <View>
            {/* Time Range Selector */}
            <View className="mb-6">
              <Text className="text-2xl font-bold mb-3">📊 Trends</Text>
              <View className="flex-row gap-2 mb-4">
                <Button
                  variant={timeRange === '7d' ? 'default' : 'outline'}
                  size="sm"
                  onPress={() => setTimeRange('7d')}
                  className="flex-1"
                >
                  <Text className={timeRange === '7d' ? 'text-primary-foreground' : ''}>
                    7 Days
                  </Text>
                </Button>
                <Button
                  variant={timeRange === '30d' ? 'default' : 'outline'}
                  size="sm"
                  onPress={() => setTimeRange('30d')}
                  className="flex-1"
                >
                  <Text className={timeRange === '30d' ? 'text-primary-foreground' : ''}>
                    30 Days
                  </Text>
                </Button>
                <Button
                  variant={timeRange === '90d' ? 'default' : 'outline'}
                  size="sm"
                  onPress={() => setTimeRange('90d')}
                  className="flex-1"
                >
                  <Text className={timeRange === '90d' ? 'text-primary-foreground' : ''}>
                    90 Days
                  </Text>
                </Button>
                <Button
                  variant={timeRange === '365d' ? 'default' : 'outline'}
                  size="sm"
                  onPress={() => setTimeRange('365d')}
                  className="flex-1"
                >
                  <Text className={timeRange === '365d' ? 'text-primary-foreground' : ''}>
                    1 Year
                  </Text>
                </Button>
              </View>
              {renderCombinedChart()}
            </View>

            {/* Patterns Section */}
            {patterns.length > 0 && (
              <View className="mb-6">
                <Text className="text-2xl font-bold mb-1">🔍 Discovered Patterns</Text>
                <Text className="text-muted-foreground mb-4">
                  Based on your tracked data
                </Text>

                {patterns.map((pattern, index) => (
                  <View
                    key={index}
                    className="bg-card border border-border rounded-lg p-4 mb-3"
                  >
                    {/* Event indicators */}
                    <View className="flex-row items-center mb-3">
                      {pattern.events.map((event, i) => (
                        <React.Fragment key={event.id}>
                          {i > 0 && <Text className="mx-2 text-muted-foreground">→</Text>}
                          <View
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: event.color }}
                          />
                          <Text className="font-semibold text-sm">{event.name}</Text>
                        </React.Fragment>
                      ))}
                    </View>

                    {/* Pattern description */}
                    <Text className="text-base mb-3">{pattern.description}</Text>

                    {/* Confidence indicator */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Text className="text-xs text-muted-foreground mr-2">
                          {getConfidenceLabel(pattern.confidence)}
                        </Text>
                        <Text className={`text-xs font-semibold ${getConfidenceColor(pattern.confidence)}`}>
                          {pattern.confidence}%
                        </Text>
                      </View>
                      <Text className="text-xs text-muted-foreground capitalize">
                        {pattern.type.replace('-', ' ')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}
