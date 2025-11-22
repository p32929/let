import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Icon } from '@/components/ui/icon';
import { Stack, router } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Dimensions, Pressable, TouchableWithoutFeedback } from 'react-native';
import { useEventsStore } from '@/lib/stores/events-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEventValuesForDateRangeComplete } from '@/db/operations/events';
import { format, subDays, parseISO } from 'date-fns';
import type { Event } from '@/types/events';
import { isDefaultValue } from '@/lib/data-optimization';
import { Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// React Native SVG - True cross-platform charting
import Svg, { Line as SvgLine, Circle, G, Text as SvgText } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;

interface EventDataPoint {
  date: string;
  value: number | string;
}

// Smart number formatting - shows integers without decimals, decimals when needed
function formatNumber(num: number): string {
  return Number.isInteger(num) ? num.toString() : num.toFixed(1);
}

type PatternStrength = 'weak' | 'moderate' | 'strong' | 'very-strong';

interface Pattern {
  description: string;
  confidence: number; // 0-100%
  type: 'co-occurrence';
  events: Event[];
  strength: PatternStrength;
  sampleSize: number;
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
  const [showCopiedDialog, setShowCopiedDialog] = React.useState(false);
  const [showNoPatternsDialog, setShowNoPatternsDialog] = React.useState(false);
  const insets = useSafeAreaInsets();

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
        const startDate = subDays(endDate, 365); // Load 1 year for pattern detection
        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');

        // Load all data for pattern detection
        const dataPromises = events.map(async (event) => {
          const values = await getEventValuesForDateRangeComplete(event.id, startStr, endStr, event.type);

          const dataPoints: EventDataPoint[] = values.map((v) => ({
            date: v.date,
            value: event.type === 'string'
              ? v.value
              : event.type === 'boolean'
                ? (v.value === 'true' ? 1 : 0)
                : (() => {
                    const num = parseFloat(v.value) || 0;
                    // Preserve integers - don't force to float
                    return Number.isInteger(num) ? Math.round(num) : num;
                  })(),
          }));

          return { event, dataPoints };
        });

        const allData = await Promise.all(dataPromises);
        setEventData(allData);

        // Calculate actual data range (excluding dates with only default values)
        const datesWithData = new Set<string>();

        // Collect all dates where at least one event has a non-default value
        allData.forEach(({ event, dataPoints }) => {
          dataPoints.forEach(d => {
            if (!isDefaultValue(String(d.value), event.type)) {
              datesWithData.add(d.date);
            }
          });
        });

        if (datesWithData.size > 0) {
          const sortedDates = Array.from(datesWithData).sort();
          const oldestDate = parseISO(sortedDates[0]);
          const newestDate = parseISO(sortedDates[sortedDates.length - 1]);
          const daysDiff = Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));

          // Set default timeRange based on actual data range
          if (daysDiff <= 7) {
            setTimeRange('7d');
          } else if (daysDiff <= 30) {
            setTimeRange('30d');
          } else if (daysDiff <= 90) {
            setTimeRange('90d');
          } else {
            setTimeRange('365d');
          }
        }

        setIsLoading(false);

        // Discover patterns from ALL data with loading state
        setIsAnalyzingPatterns(true);
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
          }, 500);
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

    const requestedDays = getDaysForRange(timeRange);

    // Get dates that have at least one non-default value (EXCLUDE dates with only default values)
    const datesWithData = new Set<string>();
    eventData.forEach(({ event, dataPoints }) => {
      dataPoints.forEach(d => {
        if (!isDefaultValue(String(d.value), event.type)) {
          datesWithData.add(d.date);
        }
      });
    });

    if (datesWithData.size === 0) {
      setChartData([]);
      return;
    }

    // Find the oldest and newest dates with actual data (not default values)
    const sortedDates = Array.from(datesWithData).sort();
    const oldestDate = sortedDates[0];
    const newestDate = sortedDates[sortedDates.length - 1];

    // Calculate cutoff date, but never go before the oldest actual data date
    const requestedCutoff = format(subDays(parseISO(newestDate), requestedDays - 1), 'yyyy-MM-dd');
    const cutoffDate = requestedCutoff < oldestDate ? oldestDate : requestedCutoff;

    // Filter to only include dates >= cutoffDate AND dates with non-default values
    const filteredChartData = eventData.map(({ event, dataPoints }) => ({
      event,
      dataPoints: dataPoints.filter((point) =>
        point.date >= cutoffDate && datesWithData.has(point.date)
      ),
    }));

    setChartData(filteredChartData);
  }, [eventData, timeRange]);

  // Helper function to calculate pattern strength
  const calculateStrength = (confidence: number): PatternStrength => {
    if (confidence >= 90) return 'very-strong';
    if (confidence >= 80) return 'strong';
    if (confidence >= 65) return 'moderate';
    return 'weak';
  };

  const discoverPatterns = (
    allData: { event: Event; dataPoints: EventDataPoint[] }[]
  ): Pattern[] => {
    if (allData.length < 2) return [];

    // Sort events by their order property to ensure consistent ordering
    const sortedData = [...allData].sort((a, b) => a.event.order - b.event.order);

    // Find the FIRST numeric event to use as the primary grouping mechanism
    const primaryEvent = sortedData.find(d => d.event.type === 'number');
    if (!primaryEvent) return [];

    const primaryData = allData.find(d => d.event.id === primaryEvent.event.id);
    if (!primaryData) return [];

    const numericValues = primaryData.dataPoints
      .filter(d => typeof d.value === 'number' && d.value > 0)
      .map(d => ({ date: d.date, value: d.value as number }));

    if (numericValues.length < 3) return []; // Reduced from 10 to 3 for more patterns

    const values = numericValues.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range < 0.1) return []; // Reduced from 1 to 0.1 to catch smaller variations

    // Check if all values are integers
    const allIntegers = values.every(v => Number.isInteger(v));

    // Create 3 buckets based on the FIRST event
    const bucketSize = range / 3;
    const buckets = allIntegers ? [
      // For integer data, round bucket boundaries to integers
      { name: 'low', min: Math.floor(min), max: Math.ceil(min + bucketSize), dates: [] as string[] },
      { name: 'mid', min: Math.ceil(min + bucketSize), max: Math.ceil(min + (bucketSize * 2)), dates: [] as string[] },
      { name: 'high', min: Math.ceil(min + (bucketSize * 2)), max: Math.ceil(max), dates: [] as string[] },
    ] : [
      // For decimal data, keep precise boundaries
      { name: 'low', min, max: min + bucketSize, dates: [] as string[] },
      { name: 'mid', min: min + bucketSize, max: min + (bucketSize * 2), dates: [] as string[] },
      { name: 'high', min: min + (bucketSize * 2), max, dates: [] as string[] },
    ];

    for (const { date, value } of numericValues) {
      if (value < buckets[0].max) buckets[0].dates.push(date);
      else if (value < buckets[1].max) buckets[1].dates.push(date);
      else buckets[2].dates.push(date);
    }

    // Store pattern data for each bucket with full details
    interface BucketPattern {
      bucket: string;
      parts: Array<{
        eventName: string;
        eventId: number;
        eventType: string;
        primaryRange?: { min: number; max: number; unit: string };
        booleanRate?: number;
        booleanPositive?: boolean;
        stringValues?: string[]; // Changed to array to store ALL values
        stringValue?: string; // Kept for backward compatibility
        stringPct?: number;
        numberRange?: { min: number; max: number; unit: string };
        numberAvg?: number;
      }>;
      relatedEvents: Event[];
      sampleSize: number;
    }

    const bucketPatterns: BucketPattern[] = [];

    // For each bucket, build detailed pattern data
    for (const bucket of buckets) {
      if (bucket.dates.length < 1) continue; // Allow single-date patterns

      const parts: BucketPattern['parts'] = [];
      const relatedEvents: Event[] = [];

      // FIRST PASS: Find boolean events and determine predominant state
      let filteredDates = bucket.dates;
      for (const { event, dataPoints } of sortedData) {
        if (event.type === 'boolean') {
          const matchingData = bucket.dates
            .map(date => dataPoints.find(d => d.date === date))
            .filter(d => d);

          if (matchingData.length > 0) {
            const trueCount = matchingData.filter(d => d && (d.value === 'true' || d.value === 1)).length;
            const rate = (trueCount / matchingData.length) * 100;
            const isPositive = rate >= 50;

            // Filter dates to only include those matching the predominant boolean state
            filteredDates = bucket.dates.filter(date => {
              const dataPoint = dataPoints.find(d => d.date === date);
              if (!dataPoint) return !isPositive; // Missing = false
              const isTrue = dataPoint.value === 'true' || dataPoint.value === 1;
              return isTrue === isPositive;
            });

            parts.push({
              eventName: event.name,
              eventId: event.id,
              eventType: 'boolean',
              booleanRate: rate,
              booleanPositive: isPositive,
            });
            relatedEvents.push(event);
            break; // Only use first boolean event for filtering
          }
        }
      }

      // SECOND PASS: Collect other events using filtered dates
      for (const { event, dataPoints } of sortedData) {
        if (event.type === 'boolean') continue; // Already processed

        const matchingData = filteredDates
          .map(date => dataPoints.find(d => d.date === date))
          .filter(d => d);

        if (matchingData.length === 0) continue;

        if (event.type === 'number') {
          const numValues = matchingData
            .filter(d => d && (typeof d.value === 'number' || !isNaN(parseFloat(String(d.value)))))
            .map(d => d && typeof d.value === 'number' ? d.value : parseFloat(String(d!.value)));

          if (numValues.length > 0) {
            const avg = numValues.reduce((a, b) => a + b, 0) / numValues.length;
            const minVal = Math.min(...numValues);
            const maxVal = Math.max(...numValues);
            const unit = event.unit || '';

            // Store range data for the primary event (use actual values, not bucket boundaries)
            if (event.id === primaryEvent.event.id) {
              parts.push({
                eventName: event.name,
                eventId: event.id,
                eventType: 'number',
                primaryRange: { min: minVal, max: maxVal, unit },
              });
            } else {
              parts.push({
                eventName: event.name,
                eventId: event.id,
                eventType: 'number',
                numberRange: { min: minVal, max: maxVal, unit },
                numberAvg: avg,
              });
            }
            relatedEvents.push(event);
          }
        } else if (event.type === 'string') {
          // Split comma-separated values and flatten
          const strValues = matchingData
            .filter(d => d && d.value && String(d.value).trim())
            .flatMap(d =>
              String(d!.value)
                .split(',')
                .map(v => v.trim().toLowerCase())
                .filter(v => v)
            );

          if (strValues.length > 0) {
            // Get all unique values
            const uniqueValues = [...new Set(strValues)];

            // Also calculate frequency for backward compatibility
            const freq: Record<string, number> = {};
            strValues.forEach(v => freq[v] = (freq[v] || 0) + 1);
            const total = strValues.length;
            const topValue = Object.entries(freq)
              .map(([value, count]) => ({ value, pct: (count / total) * 100 }))
              .sort((a, b) => b.pct - a.pct)[0];

            parts.push({
              eventName: event.name,
              eventId: event.id,
              eventType: 'string',
              stringValues: uniqueValues, // Store ALL unique values (now split by comma)
              stringValue: topValue.value, // Keep for compatibility
              stringPct: topValue.pct,
            });
            relatedEvents.push(event);
          }
        }
      }

      if (parts.length >= 1) {
        bucketPatterns.push({
          bucket: bucket.name,
          parts,
          relatedEvents,
          sampleSize: filteredDates.length,
        });
      }
    }

    // Now merge similar patterns with ranges
    const mergedPatterns: Pattern[] = [];

    if (bucketPatterns.length === 0) return [];

    // Group patterns by their "signature" (same events in same order, same trend)
    interface PatternGroup {
      signature: string;
      patterns: BucketPattern[];
    }

    const groups = new Map<string, PatternGroup>();

    for (const bucketPattern of bucketPatterns) {
      // Create signature based on event sequence and trends (not specific string values)
      const signature = bucketPattern.parts
        .map(part => {
          if (part.eventType === 'boolean') {
            return `${part.eventName}:${part.booleanPositive ? 'yes' : 'no'}`;
          } else if (part.eventType === 'string') {
            return `${part.eventName}:string`;
          } else {
            return `${part.eventName}:number`;
          }
        })
        .join('→');

      if (!groups.has(signature)) {
        groups.set(signature, { signature, patterns: [] });
      }
      groups.get(signature)!.patterns.push(bucketPattern);
    }

    // Build merged pattern descriptions with ranges
    for (const group of groups.values()) {
      const mergedParts: string[] = [];
      const allRelatedEvents = group.patterns[0].relatedEvents;
      const totalSampleSize = group.patterns.reduce((sum, p) => sum + p.sampleSize, 0);

      // Get all parts from first pattern as template
      const templateParts = group.patterns[0].parts;

      for (let i = 0; i < templateParts.length; i++) {
        const part = templateParts[i];

        if (part.eventType === 'boolean') {
          // Collect all boolean rates from all patterns
          const rates = group.patterns
            .map(p => p.parts[i]?.booleanRate)
            .filter(r => r !== undefined) as number[];

          if (rates.length > 0) {
            const minRate = Math.min(...rates);
            const maxRate = Math.max(...rates);

            if (part.booleanPositive) {
              if (minRate === maxRate) {
                mergedParts.push(`${part.eventName} ${minRate.toFixed(0)}%`);
              } else {
                mergedParts.push(`${part.eventName} ${minRate.toFixed(0)}-${maxRate.toFixed(0)}%`);
              }
            } else {
              if (minRate === maxRate) {
                mergedParts.push(`No ${part.eventName} ${(100 - minRate).toFixed(0)}%`);
              } else {
                mergedParts.push(`No ${part.eventName} ${(100 - maxRate).toFixed(0)}-${(100 - minRate).toFixed(0)}%`);
              }
            }
          }
        } else if (part.eventType === 'number') {
          if (part.primaryRange) {
            // Primary event - show the overall range across all buckets
            const allRanges = group.patterns
              .map(p => p.parts[i]?.primaryRange)
              .filter(r => r !== undefined) as Array<{ min: number; max: number; unit: string }>;

            if (allRanges.length > 0) {
              const overallMin = Math.min(...allRanges.map(r => r.min));
              const overallMax = Math.max(...allRanges.map(r => r.max));
              const unit = part.primaryRange.unit ? ` ${part.primaryRange.unit}` : '';

              if (overallMax - overallMin > 0.1) {
                mergedParts.push(`${part.eventName} ${formatNumber(overallMin)}-${formatNumber(overallMax)}${unit}`);
              } else {
                mergedParts.push(`${part.eventName} ~${formatNumber(overallMin)}${unit}`);
              }
            }
          } else if (part.numberRange) {
            // Secondary number events - show ranges
            const allRanges = group.patterns
              .map(p => p.parts[i]?.numberRange)
              .filter(r => r !== undefined) as Array<{ min: number; max: number; unit: string }>;

            if (allRanges.length > 0) {
              const overallMin = Math.min(...allRanges.map(r => r.min));
              const overallMax = Math.max(...allRanges.map(r => r.max));
              const unit = part.numberRange.unit ? ` ${part.numberRange.unit}` : '';

              if (overallMax - overallMin > 0.1) {
                mergedParts.push(`${part.eventName} ${formatNumber(overallMin)}-${formatNumber(overallMax)}${unit}`);
              } else {
                const avgVal = (overallMin + overallMax) / 2;
                mergedParts.push(`${part.eventName} ~${formatNumber(avgVal)}${unit}`);
              }
            }
          }
        } else if (part.eventType === 'string') {
          // String events - collect ALL unique values from all patterns
          const allStringValues: string[] = [];
          group.patterns.forEach(p => {
            const stringPart = p.parts[i];
            if (stringPart?.stringValues) {
              allStringValues.push(...stringPart.stringValues);
            } else if (stringPart?.stringValue) {
              // Fallback for backward compatibility
              allStringValues.push(stringPart.stringValue);
            }
          });

          if (allStringValues.length > 0) {
            const uniqueValues = [...new Set(allStringValues)];

            if (uniqueValues.length === 1) {
              // Single value
              mergedParts.push(`${part.eventName}: ${uniqueValues[0]}`);
            } else {
              // Multiple values - show as comma-separated list
              const displayValues = uniqueValues.join(', ');
              mergedParts.push(`${part.eventName}: ${displayValues}`);
            }
          }
        }
      }

      if (mergedParts.length >= 1) {
        const confidence = Math.min(95, 50 + mergedParts.length * 5);
        mergedPatterns.push({
          description: mergedParts.join(' → '),
          confidence,
          type: 'co-occurrence',
          events: allRelatedEvents,
          strength: calculateStrength(confidence),
          sampleSize: totalSampleSize,
        });
      }
    }

    // Return ALL patterns sorted by confidence (highest first)
    return mergedPatterns.sort((a, b) => b.confidence - a.confidence);
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

  const getStrengthColor = (strength: PatternStrength) => {
    switch (strength) {
      case 'very-strong': return '#16a34a'; // green-600
      case 'strong': return '#2563eb'; // blue-600
      case 'moderate': return '#f59e0b'; // amber-500
      case 'weak': return '#94a3b8'; // slate-400
    }
  };

  const getStrengthLabel = (strength: PatternStrength) => {
    switch (strength) {
      case 'very-strong': return 'Very Strong';
      case 'strong': return 'Strong';
      case 'moderate': return 'Moderate';
      case 'weak': return 'Weak';
    }
  };

  const getStrengthWidth = (strength: PatternStrength) => {
    switch (strength) {
      case 'very-strong': return '100%';
      case 'strong': return '75%';
      case 'moderate': return '50%';
      case 'weak': return '25%';
    }
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
      // Split comma-separated values and flatten into individual values
      const uniqueValues = Array.from(new Set(
        dataPoints.flatMap(d =>
          String(d.value)
            .split(',')
            .map(v => v.trim().toLowerCase())
            .filter(v => v)
        )
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
        if (point !== undefined) {
          // Handle boolean values
          if (event.type === 'boolean') {
            const boolValue = point.value === 'true' || point.value === 1 || String(point.value) === 'true';
            dataPoint[event.name] = boolValue ? 100 : 0; // True = 100%, False = 0%
            dataPoint[`${event.name}_original`] = boolValue ? 'Yes' : 'No';
          }
          // Handle numeric values
          else if (typeof point.value === 'number') {
            // Normalize to 0-100 scale
            const values = dataPoints.map((d) => typeof d.value === 'number' ? d.value : 0);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min || 1;
            const normalized = ((point.value - min) / range) * 100;

            dataPoint[event.name] = normalized;
            dataPoint[`${event.name}_original`] = point.value;
          }
        }
      });

      // Add string events as categorical values
      stringEvents.forEach(({ event, dataPoints }) => {
        const point = dataPoints.find((p) => p.date === date);
        if (point && typeof point.value === 'string') {
          // Split comma-separated values
          const stringValues = String(point.value)
            .split(',')
            .map(v => v.trim().toLowerCase())
            .filter(v => v);

          const mapping = stringValueMappings[event.name];
          if (mapping && stringValues.length > 0) {
            // Store all values as an array
            dataPoint[`${event.name}_all_values`] = stringValues;
            // Use the first value for positioning (or average of all positions)
            const positions = stringValues
              .map(val => mapping.values.indexOf(val))
              .filter(idx => idx !== -1);

            if (positions.length > 0) {
              // Average position for chart placement
              const avgIndex = positions.reduce((a, b) => a + b, 0) / positions.length;
              const position = mapping.values.length > 1
                ? (avgIndex / (mapping.values.length - 1)) * 100
                : 50;
              dataPoint[event.name] = position;
              // Store original values as comma-separated for display
              dataPoint[`${event.name}_original`] = stringValues.join(', ');
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
          Normalized to compare trends{stringEvents.length > 0 ? ' • Labeled dots = text values' : ''} • Tap for details
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
          <View style={{ height: 280, width: '100%' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View
                ref={chartRef}
                style={{ width: Math.max(screenWidth - 32, combinedChartData.length * 50) + 30, height: 280 }}
              >
                <Svg width={Math.max(screenWidth - 32, combinedChartData.length * 50) + 30} height={280}>
                  <G>
                    {/* Render lines for numeric/boolean events */}
                    {numericEvents.map(({ event }) => {
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

                    {/* Render string events as labeled dots (no lines) */}
                    {stringEvents.map(({ event }) => {
                      return (
                        <G key={event.id}>
                          {combinedChartData.map((dataPoint, index) => {
                            const value = dataPoint[event.name];
                            if (value === undefined || value === null) return null;

                            const x = 40 + (index * (Math.max(screenWidth - 72, combinedChartData.length * 50 - 40) / (combinedChartData.length - 1)));
                            const y = 210 - (value * 1.8);
                            const originalValue = dataPoint[`${event.name}_original`] || '';

                            return (
                              <G key={`${event.id}-point-${index}`}>
                                {/* Larger circle for string events */}
                                <Circle
                                  cx={x}
                                  cy={y}
                                  r={6}
                                  fill={event.color}
                                />
                                {/* Text label with the actual string value */}
                                <SvgText
                                  x={x}
                                  y={y - 12}
                                  fontSize={9}
                                  fill={event.color}
                                  textAnchor="middle"
                                  fontWeight="bold"
                                >
                                  {originalValue}
                                </SvgText>
                              </G>
                            );
                          })}
                        </G>
                      );
                    })}

                    {/* Y-axis grid lines */}
                    {[0, 25, 50, 75, 100].map((value) => {
                      const y = 210 - (value * 1.8);
                      return (
                        <SvgLine
                          key={`grid-${value}`}
                          x1={35}
                          y1={y}
                          x2={Math.max(screenWidth - 32, combinedChartData.length * 50)}
                          y2={y}
                          stroke="#e5e7eb"
                          strokeWidth={1}
                          opacity={0.5}
                        />
                      );
                    })}

                    {/* X-axis date labels */}
                    {combinedChartData.map((dataPoint, index) => {
                      const x = 40 + (index * (Math.max(screenWidth - 72, combinedChartData.length * 50 - 40) / (combinedChartData.length - 1)));
                      return (
                        <SvgText
                          key={`date-${index}`}
                          x={x}
                          y={240}
                          fontSize={10}
                          fill="#666"
                          textAnchor="middle"
                        >
                          {dataPoint.date}
                        </SvgText>
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

        {/* Tooltip Overlay - renders on top of everything */}
        {tooltipPos !== null && tooltipPos.visible && (
          <Pressable
            className="absolute inset-0 bg-black/50 items-center justify-center z-[100]"
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
                    : formatNumber(value);

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
        )}
      </View>
    );
  };

  const handleCopyPatterns = async () => {
    if (patterns.length === 0) {
      setShowNoPatternsDialog(true);
      return;
    }

    const patternsText = patterns
      .map((p, i) => `${i + 1}. ${p.description} (${p.confidence}% confidence, ${getStrengthLabel(p.strength)})`)
      .join('\n\n');

    await Clipboard.setStringAsync(patternsText);
    setShowCopiedDialog(true);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Patterns & Insights',
          headerRight: () => (
            <Pressable onPress={handleCopyPatterns} className="mr-2">
              <Icon as={Copy} className="size-5 text-foreground" />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-background p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
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

            {/* Patterns Section */}
            <View className="mb-6">
              <Text className="text-2xl font-bold mb-4">🔍 Discovered Patterns</Text>

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

                      {/* Pattern Metadata */}
                      <View className="pt-3 border-t border-[#e5e5e5] dark:border-[#262626]">
                        <View className="flex-row items-center justify-between">
                          <Text className={`text-xs font-medium ${getConfidenceColor(pattern.confidence)}`}>
                            Happens {pattern.confidence}% of the time
                          </Text>
                          <Text className="text-xs text-[#737373] dark:text-[#a3a3a3]">
                            {pattern.sampleSize} samples
                          </Text>
                        </View>
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

      {/* Copied Dialog */}
      <AlertDialog open={showCopiedDialog} onOpenChange={setShowCopiedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copied!</AlertDialogTitle>
            <AlertDialogDescription>
              Patterns have been copied to clipboard
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setShowCopiedDialog(false)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No Patterns Dialog */}
      <AlertDialog open={showNoPatternsDialog} onOpenChange={setShowNoPatternsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Patterns</AlertDialogTitle>
            <AlertDialogDescription>
              No patterns to copy yet. Try adding more data!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setShowNoPatternsDialog(false)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}