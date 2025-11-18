import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Stack, router } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Dimensions, Pressable, Modal, TouchableWithoutFeedback } from 'react-native';
import { useEventsStore } from '@/lib/stores/events-store';
import { getEventValuesForDateRangeComplete } from '@/db/operations/events';
import { format, subDays, parseISO } from 'date-fns';
import type { Event } from '@/types/events';

// React Native SVG - True cross-platform charting
import Svg, { Line as SvgLine, Circle, G } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;

interface EventDataPoint {
  date: string;
  value: number | string;
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
  const [isAnalyzingPatterns, setIsAnalyzingPatterns] = React.useState(false);
  const [timeRange, setTimeRange] = React.useState<TimeRange>('30d');

  // Redirect if no events
  React.useEffect(() => {
    if (!isLoading && events.length === 0) {
      router.replace('/');
    }
  }, [events.length, isLoading]);

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
        const startDate = subDays(endDate, 365); // Load 1 year instead of 2 for faster performance
        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');

        // Load all data for pattern detection using the complete function
        const dataPromises = events.map(async (event) => {
          // Use the new function that fills in missing dates for boolean events
          const values = await getEventValuesForDateRangeComplete(event.id, startStr, endStr, event.type);

          const dataPoints: EventDataPoint[] = values.map((v) => ({
            date: v.date,
            value: event.type === 'string'
              ? v.value
              : event.type === 'boolean'
                ? (v.value === 'true' ? 1 : 0)
                : parseFloat(v.value) || 0,
          }));

          return { event, dataPoints };
        });

        const allData = await Promise.all(dataPromises);
        setEventData(allData);
        setIsLoading(false);

        // Discover patterns from ALL data with loading state - run AFTER UI is ready
        setIsAnalyzingPatterns(true);
        // Use requestAnimationFrame for better performance
        requestAnimationFrame(() => {
          setTimeout(() => {
            try {
              const discoveredPatterns = discoverPatterns(allData);
              setPatterns(discoveredPatterns);
            } catch (error) {
              console.error('Failed to discover patterns:', error);
            } finally {
              setIsAnalyzingPatterns(false);
            }
          }, 500); // Longer delay to let charts render first
        });
      } catch (error) {
        console.error('Failed to analyze patterns:', error);
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
    const stringEvents = allData.filter((d) => d.event.type === 'string');
    const booleanEvents = allData.filter((d) => d.event.type === 'boolean');
    const numberEvents = allData.filter((d) => d.event.type === 'number');

    if (allData.length < 2) return [];

    // SMART PATTERN DISCOVERY: Group and merge similar patterns
    // Show ALL patterns (deduplication will handle quality)

    const mergedPatterns: Pattern[] = [];

    // STRATEGY 1: Group number ranges (e.g., Sleep 6-8h → ...)
    // Find number ranges that lead to similar outcomes
    for (const { event: numEvent, dataPoints: numData } of numberEvents) {

      const numericValues = numData
        .filter(d => typeof d.value === 'number')
        .map(d => ({ date: d.date, value: d.value as number }));

      if (numericValues.length < 3) continue;

      // Group dates by value ranges
      const values = numericValues.map(d => d.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;

      if (range < 1) continue; // Skip if no variation

      // Create 3 buckets: low, mid, high
      const bucketSize = range / 3;
      const lowThreshold = min + bucketSize;
      const highThreshold = min + (bucketSize * 2);

      const lowDates = numericValues.filter(d => d.value < lowThreshold).map(d => d.date);
      const midDates = numericValues.filter(d => d.value >= lowThreshold && d.value < highThreshold).map(d => d.date);
      const highDates = numericValues.filter(d => d.value >= highThreshold).map(d => d.date);

      // Analyze each range
      for (const { rangeName, dates, rangeMin, rangeMax } of [
        { rangeName: 'low', dates: lowDates, rangeMin: min, rangeMax: lowThreshold },
        { rangeName: 'mid', dates: midDates, rangeMin: lowThreshold, rangeMax: highThreshold },
        { rangeName: 'high', dates: highDates, rangeMin: highThreshold, rangeMax: max },
      ]) {
        if (dates.length < 2) continue;

        const outcomes: string[] = [];
        const relatedEvents: Event[] = [numEvent];

        // Check correlations with STRING events - AGGREGATE ALL VALUES
        for (const { event: strEvent, dataPoints: strData } of stringEvents) {
          const strValues = dates
            .map(date => strData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'string')
            .map(d => String(d!.value).trim().toLowerCase())
            .filter(v => v);

          if (strValues.length >= 2) {
            // Calculate frequency distribution
            const freq: Record<string, number> = {};
            strValues.forEach(v => freq[v] = (freq[v] || 0) + 1);
            const total = strValues.length;

            // Get top 3 values with percentages
            const sortedValues = Object.entries(freq)
              .map(([value, count]) => ({ value, pct: (count / total) * 100 }))
              .filter(v => v.pct >= 15) // Only show if ≥15%
              .sort((a, b) => b.pct - a.pct)
              .slice(0, 3);

            if (sortedValues.length > 0) {
              relatedEvents.push(strEvent);
              const valueStr = sortedValues
                .map(v => `${v.value} (${v.pct.toFixed(0)}%)`)
                .join(', ');
              outcomes.push(`${strEvent.name}: ${valueStr}`);
            }
          }
        }

        // Check correlations with BOOLEAN events
        for (const { event: boolEvent, dataPoints: boolData } of booleanEvents) {
          const boolValues = dates
            .map(date => boolData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'number')
            .map(d => d!.value as number);

          if (boolValues.length >= 2) {
            const trueCount = boolValues.filter(v => v > 0.5).length;
            const rate = (trueCount / boolValues.length) * 100;

            // Only include if strong correlation (>70% or <30%)
            if (rate >= 70) {
              relatedEvents.push(boolEvent);
              outcomes.push(rate >= 85 ? boolEvent.name : `${boolEvent.name} (${rate.toFixed(0)}%)`);
            } else if (rate <= 30) {
              relatedEvents.push(boolEvent);
              outcomes.push(rate <= 15 ? `No ${boolEvent.name}` : `No ${boolEvent.name} (${(100 - rate).toFixed(0)}%)`);
            }
          }
        }

        // Check correlations with other NUMBER events
        for (const { event: otherNum, dataPoints: otherData } of numberEvents) {
          if (otherNum.id === numEvent.id) continue;

          const otherValues = dates
            .map(date => otherData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'number')
            .map(d => d!.value as number);

          if (otherValues.length >= 2) {
            const avg = otherValues.reduce((a, b) => a + b, 0) / otherValues.length;
            const minVal = Math.min(...otherValues);
            const maxVal = Math.max(...otherValues);
            const otherUnit = otherNum.unit ? ` ${otherNum.unit}` : '';

            if (maxVal - minVal > 0.5) {
              relatedEvents.push(otherNum);
              outcomes.push(`${otherNum.name} ${minVal.toFixed(1)}-${maxVal.toFixed(1)}${otherUnit}`);
            } else if (avg > 0.1) {
              relatedEvents.push(otherNum);
              outcomes.push(`${otherNum.name} ${avg.toFixed(1)}${otherUnit}`);
            }
          }
        }

        if (outcomes.length >= 2) { // Only show if at least 2 correlations
          const unit = numEvent.unit ? ` ${numEvent.unit}` : '';
          const description = `${numEvent.name} ${rangeMin.toFixed(1)}-${rangeMax.toFixed(1)}${unit} → ${outcomes.join(' → ')}`;
          mergedPatterns.push({
            description,
            confidence: Math.min(95, 65 + outcomes.length * 5),
            type: 'co-occurrence',
            events: relatedEvents,
          });
        }
      }
    }

    // STRATEGY 2: Boolean-based patterns with aggregated string distributions
    for (const { event: boolEvent, dataPoints: boolData } of booleanEvents) {
      const trueDates = boolData
        .filter(d => typeof d.value === 'number' && d.value > 0.5)
        .map(d => d.date);

      const falseDates = boolData
        .filter(d => typeof d.value === 'number' && d.value <= 0.5)
        .map(d => d.date);

      // Analyze TRUE states
      if (trueDates.length >= 2) {
        const outcomes: string[] = [];
        const relatedEvents: Event[] = [boolEvent];

        // STRING events - show distribution
        for (const { event: strEvent, dataPoints: strData } of stringEvents) {
          const strValues = trueDates
            .map(date => strData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'string')
            .map(d => String(d!.value).trim().toLowerCase())
            .filter(v => v);

          if (strValues.length >= 2) {
            const freq: Record<string, number> = {};
            strValues.forEach(v => freq[v] = (freq[v] || 0) + 1);
            const total = strValues.length;

            const sortedValues = Object.entries(freq)
              .map(([value, count]) => ({ value, pct: (count / total) * 100 }))
              .filter(v => v.pct >= 15)
              .sort((a, b) => b.pct - a.pct)
              .slice(0, 3);

            if (sortedValues.length > 0) {
              relatedEvents.push(strEvent);
              const valueStr = sortedValues
                .map(v => `${v.value} (${v.pct.toFixed(0)}%)`)
                .join(', ');
              outcomes.push(`${strEvent.name}: ${valueStr}`);
            }
          }
        }

        // NUMBER events
        for (const { event: numEvent, dataPoints: numData } of numberEvents) {
          const numValues = trueDates
            .map(date => numData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'number')
            .map(d => d!.value as number);

          if (numValues.length >= 2) {
            const avg = numValues.reduce((a, b) => a + b, 0) / numValues.length;
            const minVal = Math.min(...numValues);
            const maxVal = Math.max(...numValues);
            const unit = numEvent.unit ? ` ${numEvent.unit}` : '';

            if (maxVal - minVal > 0.5) {
              relatedEvents.push(numEvent);
              outcomes.push(`${numEvent.name} ${minVal.toFixed(1)}-${maxVal.toFixed(1)}${unit}`);
            } else if (avg > 0.1) {
              relatedEvents.push(numEvent);
              outcomes.push(`${numEvent.name} ${avg.toFixed(1)}${unit}`);
            }
          }
        }

        // BOOLEAN events
        for (const { event: otherBool, dataPoints: otherData } of booleanEvents) {
          if (otherBool.id === boolEvent.id) continue;

          const boolValues = trueDates
            .map(date => otherData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'number')
            .map(d => d!.value as number);

          if (boolValues.length >= 2) {
            const trueCount = boolValues.filter(v => v > 0.5).length;
            const rate = (trueCount / boolValues.length) * 100;

            if (rate >= 70) {
              relatedEvents.push(otherBool);
              outcomes.push(rate >= 85 ? otherBool.name : `${otherBool.name} (${rate.toFixed(0)}%)`);
            } else if (rate <= 30) {
              relatedEvents.push(otherBool);
              outcomes.push(rate <= 15 ? `No ${otherBool.name}` : `No ${otherBool.name} (${(100 - rate).toFixed(0)}%)`);
            }
          }
        }

        if (outcomes.length >= 2) {
          const description = `${boolEvent.name} → ${outcomes.join(' → ')}`;
          mergedPatterns.push({
            description,
            confidence: Math.min(95, 65 + outcomes.length * 5),
            type: 'co-occurrence',
            events: relatedEvents,
          });
        }
      }

      // Analyze FALSE states
      if (falseDates.length >= 2) {
        const outcomes: string[] = [];
        const relatedEvents: Event[] = [boolEvent];

        // STRING events
        for (const { event: strEvent, dataPoints: strData } of stringEvents) {
          const strValues = falseDates
            .map(date => strData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'string')
            .map(d => String(d!.value).trim().toLowerCase())
            .filter(v => v);

          if (strValues.length >= 2) {
            const freq: Record<string, number> = {};
            strValues.forEach(v => freq[v] = (freq[v] || 0) + 1);
            const total = strValues.length;

            const sortedValues = Object.entries(freq)
              .map(([value, count]) => ({ value, pct: (count / total) * 100 }))
              .filter(v => v.pct >= 15)
              .sort((a, b) => b.pct - a.pct)
              .slice(0, 3);

            if (sortedValues.length > 0) {
              relatedEvents.push(strEvent);
              const valueStr = sortedValues
                .map(v => `${v.value} (${v.pct.toFixed(0)}%)`)
                .join(', ');
              outcomes.push(`${strEvent.name}: ${valueStr}`);
            }
          }
        }

        // NUMBER events
        for (const { event: numEvent, dataPoints: numData } of numberEvents) {
          const numValues = falseDates
            .map(date => numData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'number')
            .map(d => d!.value as number);

          if (numValues.length >= 2) {
            const avg = numValues.reduce((a, b) => a + b, 0) / numValues.length;
            const minVal = Math.min(...numValues);
            const maxVal = Math.max(...numValues);
            const unit = numEvent.unit ? ` ${numEvent.unit}` : '';

            if (maxVal - minVal > 0.5) {
              relatedEvents.push(numEvent);
              outcomes.push(`${numEvent.name} ${minVal.toFixed(1)}-${maxVal.toFixed(1)}${unit}`);
            } else if (avg > 0.1) {
              relatedEvents.push(numEvent);
              outcomes.push(`${numEvent.name} ${avg.toFixed(1)}${unit}`);
            }
          }
        }

        // BOOLEAN events
        for (const { event: otherBool, dataPoints: otherData } of booleanEvents) {
          if (otherBool.id === boolEvent.id) continue;

          const boolValues = falseDates
            .map(date => otherData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'number')
            .map(d => d!.value as number);

          if (boolValues.length >= 2) {
            const trueCount = boolValues.filter(v => v > 0.5).length;
            const rate = (trueCount / boolValues.length) * 100;

            if (rate >= 70) {
              relatedEvents.push(otherBool);
              outcomes.push(rate >= 85 ? otherBool.name : `${otherBool.name} (${rate.toFixed(0)}%)`);
            } else if (rate <= 30) {
              relatedEvents.push(otherBool);
              outcomes.push(rate <= 15 ? `No ${otherBool.name}` : `No ${otherBool.name} (${(100 - rate).toFixed(0)}%)`);
            }
          }
        }

        if (outcomes.length >= 2) {
          const description = `NOT ${boolEvent.name} → ${outcomes.join(' → ')}`;
          mergedPatterns.push({
            description,
            confidence: Math.min(95, 65 + outcomes.length * 5),
            type: 'co-occurrence',
            events: relatedEvents,
          });
        }
      }
    }

    // DEDUPLICATION: Remove patterns that share >70% of the same events
    const deduplicated: Pattern[] = [];

    for (const pattern of mergedPatterns) {
      let isDuplicate = false;

      for (const existing of deduplicated) {
        // Get event IDs for comparison
        const patternEventIds = new Set(pattern.events.map(e => e.id));
        const existingEventIds = new Set(existing.events.map(e => e.id));

        // Calculate overlap
        const intersection = new Set([...patternEventIds].filter(x => existingEventIds.has(x)));
        const union = new Set([...patternEventIds, ...existingEventIds]);
        const overlapRatio = intersection.size / Math.min(patternEventIds.size, existingEventIds.size);

        // If >70% overlap, it's a duplicate - keep the one with higher confidence
        if (overlapRatio > 0.7) {
          isDuplicate = true;

          // Replace existing with new if new has higher confidence
          if (pattern.confidence > existing.confidence) {
            const index = deduplicated.indexOf(existing);
            deduplicated[index] = pattern;
          }
          break;
        }
      }

      if (!isDuplicate) {
        deduplicated.push(pattern);
      }
    }

    return deduplicated.sort((a, b) => b.confidence - a.confidence);
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

  const CombinedChart = () => {
    // State for mobile tooltip
    const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number; visible: boolean; data: any; date: string } | null>(null);
    const chartRef = React.useRef<View>(null);

    // Calculate data
    const numericEvents = chartData.filter((d) => d.event.type !== 'string' && d.dataPoints.length > 0);
    const stringEvents = chartData.filter((d) => d.event.type === 'string' && d.dataPoints.length > 0);

    // Check if we should render
    if (chartData.length === 0 || (numericEvents.length === 0 && stringEvents.length === 0)) {
      return null;
    }

    // Get all unique dates from both numeric and string events
    const allDates = Array.from(
      new Set([
        ...numericEvents.flatMap((d) => d.dataPoints.map((p) => p.date)),
        ...stringEvents.flatMap((d) => d.dataPoints.map((p) => p.date))
      ])
    ).sort();

    // Create mapping for string values to numbers
    const stringValueMappings: Record<string, { values: string[]; colorMap: Record<string, string> }> = {};
    stringEvents.forEach(({ event, dataPoints }) => {
      const uniqueValues = Array.from(new Set(
        dataPoints.map(d => String(d.value).trim().toLowerCase()).filter(v => v)
      )).sort();

      // Assign each unique value a position from 0 to 100
      const colorMap: Record<string, string> = {};
      uniqueValues.forEach((val, idx) => {
        const hue = (idx * 360) / Math.max(uniqueValues.length, 1);
        colorMap[val] = `hsl(${hue}, 70%, 60%)`;
      });

      stringValueMappings[event.name] = { values: uniqueValues, colorMap };
    });

    // Create chart data with all events combined
    const combinedChartData = allDates.map((date) => {
      const dataPoint: any = {
        date: format(parseISO(date), 'MMM d'),
        fullDate: date,
      };

      numericEvents.forEach(({ event, dataPoints }) => {
        const point = dataPoints.find((p) => p.date === date);
        if (point && typeof point.value === 'number') {
          // Normalize to 0-100 scale
          const values = dataPoints.map((d) => typeof d.value === 'number' ? d.value : 0);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min || 1;
          const normalized = ((point.value - min) / range) * 100;

          dataPoint[event.name] = normalized;
          dataPoint[`${event.name}_original`] = point.value;
        }
      });

      // Add string events as categorical values
      stringEvents.forEach(({ event, dataPoints }) => {
        const point = dataPoints.find((p) => p.date === date);
        if (point && typeof point.value === 'string') {
          const stringValue = String(point.value).trim().toLowerCase();
          const mapping = stringValueMappings[event.name];
          if (mapping && stringValue) {
            // Map to position in the list (evenly spaced 0-100)
            const index = mapping.values.indexOf(stringValue);
            if (index !== -1) {
              const position = mapping.values.length > 1
                ? (index / (mapping.values.length - 1)) * 100
                : 50;
              dataPoint[event.name] = position;
              dataPoint[`${event.name}_original`] = stringValue;
            }
          }
        }
      });

      return dataPoint;
    });

    return (
      <View className="bg-card border border-border rounded-lg p-4 mb-4">
        <Text className="font-semibold text-lg mb-2">All Events Combined</Text>
        <Text className="text-sm text-muted-foreground mb-4">
          Normalized view to see patterns (scrollable){stringEvents.length > 0 ? ' • Dashed lines = text events' : ''}
        </Text>

        <View className="mb-4">
          {/* Legend showing all events */}
          <View className="flex-row flex-wrap mb-3">
            {[...numericEvents, ...stringEvents].map(({ event }) => (
              <View key={event.id} className="flex-row items-center mr-4 mb-2">
                <View style={{ width: 12, height: 12, backgroundColor: event.color, marginRight: 6, borderRadius: 6 }} />
                <Text className="text-xs">{event.name}</Text>
                {event.unit && <Text className="text-xs text-muted-foreground ml-1">({event.unit})</Text>}
              </View>
            ))}
          </View>

          {/* Combined chart with all lines - Custom SVG (True cross-platform) */}
          <View style={{ height: 250, width: '100%' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View
                ref={chartRef}
                style={{ width: Math.max(screenWidth - 32, combinedChartData.length * 50), height: 250 }}
              >
                <Svg width={Math.max(screenWidth - 32, combinedChartData.length * 50)} height={250}>
                  <G>
                    {/* Render lines for each event */}
                    {[...numericEvents, ...stringEvents].map(({ event }) => {
                      // Create path points for this event's line
                      const points: Array<{ x: number; y: number }> = [];

                      combinedChartData.forEach((dataPoint, index) => {
                        const value = dataPoint[event.name];
                        if (value !== undefined && value !== null) {
                          const x = 40 + (index * (Math.max(screenWidth - 72, combinedChartData.length * 50 - 40) / (combinedChartData.length - 1)));
                          const y = 210 - (value * 1.8); // Scale: 0-100 maps to 210-30 (inverted Y axis)
                          points.push({ x, y });
                        }
                      });

                      // Draw line segments
                      return (
                        <G key={event.id}>
                          {points.map((point, i) => {
                            if (i === 0) return null;
                            const prevPoint = points[i - 1];
                            return (
                              <SvgLine
                                key={`${event.id}-line-${i}`}
                                x1={prevPoint.x}
                                y1={prevPoint.y}
                                x2={point.x}
                                y2={point.y}
                                stroke={event.color}
                                strokeWidth={2}
                              />
                            );
                          })}
                          {/* Draw visible circles at data points */}
                          {points.map((point, i) => (
                            <Circle
                              key={`${event.id}-point-${i}`}
                              cx={point.x}
                              cy={point.y}
                              r={4}
                              fill={event.color}
                            />
                          ))}
                        </G>
                      );
                    })}
                  </G>
                </Svg>

                {/* Cross-platform touch overlay */}
                <TouchableWithoutFeedback
                  onPress={(event) => {
                    const nativeEvent = event.nativeEvent as any;
                    const locationX = nativeEvent.locationX || nativeEvent.pageX || 0;
                    const locationY = nativeEvent.locationY || nativeEvent.pageY || 0;

                    // Find nearest data point
                    let nearestIndex = -1;
                    let minDistance = Infinity;

                    combinedChartData.forEach((_, index) => {
                      const x = 40 + (index * (Math.max(screenWidth - 72, combinedChartData.length * 50 - 40) / (combinedChartData.length - 1)));
                      const distance = Math.abs(locationX - x);

                      if (distance < minDistance && distance < 50) { // Within 50px for easier clicking
                        minDistance = distance;
                        nearestIndex = index;
                      }
                    });

                    if (nearestIndex !== -1) {
                      const dataPoint = combinedChartData[nearestIndex];
                      const x = 40 + (nearestIndex * (Math.max(screenWidth - 72, combinedChartData.length * 50 - 40) / (combinedChartData.length - 1)));

                      setTooltipPos({
                        x,
                        y: locationY,
                        visible: true,
                        data: dataPoint,
                        date: dataPoint.date
                      });
                    }
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  />
                </TouchableWithoutFeedback>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Tooltip Modal - renders on top of everything */}
        <Modal
          visible={tooltipPos !== null && tooltipPos.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setTooltipPos(null)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setTooltipPos(null)}
          >
            {tooltipPos && (
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: 16,
                  borderRadius: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 10,
                  minWidth: 200,
                  maxWidth: 300,
                }}
              >
                <Text style={{ color: '#000', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
                  {tooltipPos.data.date}
                </Text>
                {[...numericEvents, ...stringEvents].map(({ event }) => {
                  const value = tooltipPos.data[event.name];
                  if (value === undefined || value === null) return null;

                  // Get original value
                  const originalValue = tooltipPos.data[event.name + '_original'];
                  const displayValue = (originalValue !== undefined && originalValue !== null)
                    ? originalValue
                    : value.toFixed(1);

                  return (
                    <View key={event.id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: event.color,
                          marginRight: 8,
                        }}
                      />
                      <Text style={{ color: '#000', fontSize: 12, flex: 1 }}>
                        {event.name}: {displayValue}{event.unit ? ` ${event.unit}` : ''}
                      </Text>
                    </View>
                  );
                })}
                <Text style={{ color: '#666', fontSize: 10, textAlign: 'center', marginTop: 12, fontStyle: 'italic' }}>
                  Tap anywhere to close
                </Text>
              </View>
            )}
          </Pressable>
        </Modal>
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
          <View className="py-4">
            {/* Loading skeletons for dashboard */}
            <View className="mb-6">
              <Skeleton className="w-32 h-8 rounded mb-3" />
              <View className="flex-row gap-2 mb-4">
                <Skeleton className="flex-1 h-9 rounded" />
                <Skeleton className="flex-1 h-9 rounded" />
                <Skeleton className="flex-1 h-9 rounded" />
              </View>
              <Skeleton className="w-full h-64 rounded mb-4" />
            </View>
            <View className="mb-6">
              <Skeleton className="w-48 h-8 rounded mb-3" />
              {[1, 2, 3].map((i) => (
                <View key={i} className="bg-card border border-border rounded-lg p-4 mb-3">
                  <View className="flex-row items-center mb-3">
                    <Skeleton className="w-3 h-3 rounded-full mr-2" />
                    <Skeleton className="w-20 h-4 rounded" />
                    <Skeleton className="w-3 h-3 rounded-full mx-2" />
                    <Skeleton className="w-20 h-4 rounded" />
                  </View>
                  <Skeleton className="w-full h-4 rounded mb-2" />
                  <Skeleton className="w-3/4 h-4 rounded mb-3" />
                  <View className="flex-row items-center justify-between">
                    <Skeleton className="w-24 h-3 rounded" />
                    <Skeleton className="w-20 h-3 rounded" />
                  </View>
                </View>
              ))}
            </View>
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
              <CombinedChart />
            </View>

            {/* Patterns Section - Always show, just indicate loading state */}
            <View className="mb-6">
              <Text className="text-2xl font-bold mb-1">🔍 Discovered Patterns</Text>
              <Text className="text-muted-foreground mb-4">
                {isAnalyzingPatterns ? 'Analyzing your data...' : 'Based on your tracked data'}
              </Text>

              {isAnalyzingPatterns ? (
                /* Skeleton loading effect */
                <>
                  {[1, 2, 3].map((i) => (
                    <View key={i} className="bg-card border border-border rounded-lg p-4 mb-3">
                      <View className="flex-row items-center mb-3">
                        <Skeleton className="w-3 h-3 rounded-full mr-2" />
                        <Skeleton className="w-20 h-4 rounded" />
                        <Skeleton className="w-3 h-3 rounded-full mx-2" />
                        <Skeleton className="w-20 h-4 rounded" />
                      </View>
                      <Skeleton className="w-full h-4 rounded mb-2" />
                      <Skeleton className="w-3/4 h-4 rounded mb-3" />
                      <View className="flex-row items-center justify-between">
                        <Skeleton className="w-24 h-3 rounded" />
                        <Skeleton className="w-20 h-3 rounded" />
                      </View>
                    </View>
                  ))}
                </>
              ) : patterns.length > 0 ? (
                <>
                  {patterns.map((pattern, index) => {
                  // Create a map of event names to colors for quick lookup
                  const eventColorMap: Record<string, string> = {};
                  pattern.events.forEach(event => {
                    eventColorMap[event.name] = event.color;
                  });

                  // Split description by arrows and render each part with color indicator
                  const renderColoredDescription = () => {
                    const parts = pattern.description.split(' → ');
                    return parts.map((part, i) => {
                      // Find which event this part belongs to
                      let eventColor = '#999';
                      for (const event of pattern.events) {
                        if (part.includes(event.name)) {
                          eventColor = event.color;
                          break;
                        }
                      }

                      // Split by percentage to add separator
                      const percentMatch = part.match(/^(.+?)(\s+\d+%)$/);
                      const mainText = percentMatch ? percentMatch[1].trim() : part.trim();
                      const percentText = percentMatch ? percentMatch[2].trim() : null;

                      return (
                        <View key={i} className="flex-row items-center flex-shrink">
                          {i > 0 && <Text className="text-muted-foreground mx-1">→</Text>}
                          <View
                            className="w-2 h-2 rounded-full mr-1.5 flex-shrink-0"
                            style={{ backgroundColor: eventColor }}
                          />
                          <Text className="text-sm flex-shrink" numberOfLines={undefined}>{mainText}</Text>
                          {percentText && (
                            <>
                              <Text className="text-muted-foreground mx-1">•</Text>
                              <Text className="text-xs font-medium flex-shrink-0" style={{ color: '#888' }}>{percentText}</Text>
                            </>
                          )}
                        </View>
                      );
                    });
                  };

                  return (
                    <View
                      key={index}
                      className="bg-card border border-border rounded-lg p-4 mb-3"
                    >
                      {/* Pattern description with inline colors */}
                      <View className="flex-row flex-wrap items-start mb-3">
                        {renderColoredDescription()}
                      </View>

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
                  );
                })}
                </>
              ) : (
                <Text className="text-sm text-muted-foreground">
                  No clear patterns found yet. Keep tracking to discover insights!
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}
