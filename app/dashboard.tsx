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

        // Discover patterns from ALL data with loading state
        setIsAnalyzingPatterns(true);
        setTimeout(() => {
          try {
            const discoveredPatterns = discoverPatterns(allData);
            setPatterns(discoveredPatterns);
          } catch (error) {
            console.error('Failed to discover patterns:', error);
          } finally {
            setIsAnalyzingPatterns(false);
          }
        }, 100); // Small delay to ensure UI updates
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
    const stringEvents = allData.filter((d) => d.event.type === 'string');
    const booleanEvents = allData.filter((d) => d.event.type === 'boolean');
    const numberEvents = allData.filter((d) => d.event.type === 'number');

    if (allData.length < 2) return patterns;

    // COMPREHENSIVE PATTERN DISCOVERY FOR MAXIMUM PREDICTIVE VALUE
    // Goal: Find ALL meaningful patterns with as many correlated events as possible

    // 1. STRING-BASED PATTERNS: For each string value, analyze ALL other events
    for (const { event: stringEvent, dataPoints: stringData } of stringEvents) {
      if (stringData.length < 1) continue;

      // Find all unique string values
      const valueFrequency: Record<string, number> = {};
      stringData.forEach(d => {
        const val = String(d.value).trim().toLowerCase();
        if (val) valueFrequency[val] = (valueFrequency[val] || 0) + 1;
      });

      // Analyze each string value that appears at least once
      const allValues = Object.entries(valueFrequency)
        .filter(([_, count]) => count >= 1)
        .map(([value]) => value);

      for (const value of allValues) {
        // Find days with this string value
        const matchingDates = stringData
          .filter(d => String(d.value).trim().toLowerCase() === value)
          .map(d => d.date);

        if (matchingDates.length < 1) continue;

        // Analyze ALL outcomes for this string value
        const outcomes: string[] = [];
        const relatedEvents: Event[] = [stringEvent];

        // Other days (for comparison)
        const otherDates = stringData
          .filter(d => String(d.value).trim().toLowerCase() !== value && String(d.value).trim() !== '')
          .map(d => d.date);

        // Check EVERY number event
        for (const { event: numEvent, dataPoints: numData } of numberEvents) {
          const matchingValues = matchingDates
            .map(date => numData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'number')
            .map(d => d!.value as number);

          const otherValues = otherDates.length > 0 ? otherDates
            .map(date => numData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'number')
            .map(d => d!.value as number) : [];

          if (matchingValues.length > 0) {
            const avgMatching = matchingValues.reduce((a, b) => a + b, 0) / matchingValues.length;
            const minMatching = Math.min(...matchingValues);
            const maxMatching = Math.max(...matchingValues);
            const unit = numEvent.unit ? ` ${numEvent.unit}` : '';

            // Include if there's a difference OR if there's no comparison data
            let shouldInclude = false;
            if (otherValues.length > 0) {
              const avgOther = otherValues.reduce((a, b) => a + b, 0) / otherValues.length;
              const diff = Math.abs(avgMatching - avgOther);
              const percentDiff = avgOther > 0 ? (diff / avgOther) * 100 : 0;
              shouldInclude = percentDiff > 5 || diff > 0.5;
            } else {
              // No comparison data, include if value is meaningful (non-zero)
              shouldInclude = avgMatching > 0.1;
            }

            if (shouldInclude) {
              relatedEvents.push(numEvent);
              if (maxMatching - minMatching > 0.5) {
                outcomes.push(`${numEvent.name} ${minMatching.toFixed(1)}-${maxMatching.toFixed(1)}${unit}`);
              } else {
                outcomes.push(`${numEvent.name} ${avgMatching.toFixed(1)}${unit}`);
              }
            }
          }
        }

        // Check EVERY boolean event
        for (const { event: boolEvent, dataPoints: boolData } of booleanEvents) {
          const matchingValues = matchingDates
            .map(date => boolData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'number')
            .map(d => d!.value as number);

          const otherValues = otherDates.length > 0 ? otherDates
            .map(date => boolData.find(d => d.date === date))
            .filter(d => d && typeof d.value === 'number')
            .map(d => d!.value as number) : [];

          if (matchingValues.length > 0) {
            const matchingTrue = matchingValues.filter(v => v > 0.5).length;
            const matchingRate = (matchingTrue / matchingValues.length) * 100;

            let shouldInclude = false;
            let outcomeText = '';

            if (otherValues.length > 0) {
              const otherTrue = otherValues.filter(v => v > 0.5).length;
              const otherRate = (otherTrue / otherValues.length) * 100;
              const diff = matchingRate - otherRate;

              if (Math.abs(diff) > 10) {
                shouldInclude = true;
                relatedEvents.push(boolEvent);
                if (diff > 0) {
                  outcomeText = matchingRate >= 80
                    ? boolEvent.name
                    : `${boolEvent.name} ${matchingRate.toFixed(0)}%`;
                } else {
                  outcomeText = matchingRate <= 20
                    ? `No ${boolEvent.name}`
                    : `${boolEvent.name} ${matchingRate.toFixed(0)}%`;
                }
              }
            } else {
              // No comparison, include if rate is high or low
              if (matchingRate >= 70) {
                shouldInclude = true;
                relatedEvents.push(boolEvent);
                outcomeText = boolEvent.name;
              } else if (matchingRate <= 30) {
                shouldInclude = true;
                relatedEvents.push(boolEvent);
                outcomeText = `No ${boolEvent.name}`;
              }
            }

            if (shouldInclude && outcomeText) {
              outcomes.push(outcomeText);
            }
          }
        }

        // Create pattern with ALL correlated events
        if (outcomes.length > 0) {
          // Format as concise formula: "Dress color 'yellow' → Sleep 5-7h → Good day → ..."
          const description = `${stringEvent.name} "${value}" → ${outcomes.join(' → ')}`;
          patterns.push({
            description,
            confidence: Math.min(95, 65 + outcomes.length * 4),
            type: 'co-occurrence',
            events: relatedEvents,
          });
        }
      }
    }

    // 2. BOOLEAN-BASED PATTERNS: When a boolean is true/false, what else happens?
    for (const { event: boolEvent, dataPoints: boolData } of booleanEvents) {
      if (boolData.length < 1) continue;

      // Days when boolean is true
      const trueDates = boolData
        .filter(d => typeof d.value === 'number' && d.value > 0.5)
        .map(d => d.date);

      // Days when boolean is false
      const falseDates = boolData
        .filter(d => typeof d.value === 'number' && d.value <= 0.5)
        .map(d => d.date);

      if (trueDates.length < 1) continue;

      // Analyze what happens when boolean is TRUE
      const trueOutcomes: string[] = [];
      const trueRelatedEvents: Event[] = [boolEvent];

      // Check number events
      for (const { event: numEvent, dataPoints: numData } of numberEvents) {
        const trueValues = trueDates
          .map(date => numData.find(d => d.date === date))
          .filter(d => d && typeof d.value === 'number')
          .map(d => d!.value as number);

        const falseValues = falseDates.length > 0 ? falseDates
          .map(date => numData.find(d => d.date === date))
          .filter(d => d && typeof d.value === 'number')
          .map(d => d!.value as number) : [];

        if (trueValues.length > 0) {
          const avgTrue = trueValues.reduce((a, b) => a + b, 0) / trueValues.length;
          const minTrue = Math.min(...trueValues);
          const maxTrue = Math.max(...trueValues);
          const unit = numEvent.unit ? ` ${numEvent.unit}` : '';

          let shouldInclude = false;
          if (falseValues.length > 0) {
            const avgFalse = falseValues.reduce((a, b) => a + b, 0) / falseValues.length;
            const diff = Math.abs(avgTrue - avgFalse);
            const percentDiff = avgFalse > 0 ? (diff / avgFalse) * 100 : 0;
            shouldInclude = percentDiff > 5 || diff > 0.5;
          } else {
            shouldInclude = avgTrue > 0.1;
          }

          if (shouldInclude) {
            trueRelatedEvents.push(numEvent);
            if (maxTrue - minTrue > 0.5) {
              trueOutcomes.push(`${numEvent.name} ${minTrue.toFixed(1)}-${maxTrue.toFixed(1)}${unit}`);
            } else {
              trueOutcomes.push(`${numEvent.name} ${avgTrue.toFixed(1)}${unit}`);
            }
          }
        }
      }

      // Check other boolean events
      for (const { event: otherBool, dataPoints: otherData } of booleanEvents) {
        if (otherBool.id === boolEvent.id) continue;

        const trueValues = trueDates
          .map(date => otherData.find(d => d.date === date))
          .filter(d => d && typeof d.value === 'number')
          .map(d => d!.value as number);

        const falseValues = falseDates.length > 0 ? falseDates
          .map(date => otherData.find(d => d.date === date))
          .filter(d => d && typeof d.value === 'number')
          .map(d => d!.value as number) : [];

        if (trueValues.length > 0) {
          const trueTrue = trueValues.filter(v => v > 0.5).length;
          const trueRate = (trueTrue / trueValues.length) * 100;

          let shouldInclude = false;
          let outcomeText = '';

          if (falseValues.length > 0) {
            const falseTrue = falseValues.filter(v => v > 0.5).length;
            const falseRate = (falseTrue / falseValues.length) * 100;
            const diff = trueRate - falseRate;

            if (Math.abs(diff) > 10) {
              shouldInclude = true;
              trueRelatedEvents.push(otherBool);
              if (diff > 0) {
                outcomeText = trueRate >= 80
                  ? otherBool.name
                  : `${otherBool.name} ${trueRate.toFixed(0)}%`;
              } else {
                outcomeText = trueRate <= 20
                  ? `No ${otherBool.name}`
                  : `${otherBool.name} ${trueRate.toFixed(0)}%`;
              }
            }
          } else {
            if (trueRate >= 70) {
              shouldInclude = true;
              trueRelatedEvents.push(otherBool);
              outcomeText = otherBool.name;
            } else if (trueRate <= 30) {
              shouldInclude = true;
              trueRelatedEvents.push(otherBool);
              outcomeText = `No ${otherBool.name}`;
            }
          }

          if (shouldInclude && outcomeText) {
            trueOutcomes.push(outcomeText);
          }
        }
      }

      // Check string events
      for (const { event: strEvent, dataPoints: strData } of stringEvents) {
        const trueStrValues = trueDates
          .map(date => strData.find(d => d.date === date))
          .filter(d => d && typeof d.value === 'string')
          .map(d => String(d!.value).trim().toLowerCase())
          .filter(v => v);

        if (trueStrValues.length > 0) {
          // Find most common string value when boolean is true
          const freq: Record<string, number> = {};
          trueStrValues.forEach(v => freq[v] = (freq[v] || 0) + 1);
          const mostCommon = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];

          if (mostCommon && mostCommon[1] / trueStrValues.length >= 0.5) {
            trueRelatedEvents.push(strEvent);
            const pct = ((mostCommon[1] / trueStrValues.length) * 100).toFixed(0);
            trueOutcomes.push(`${strEvent.name} "${mostCommon[0]}" ${pct}%`);
          }
        }
      }

      if (trueOutcomes.length > 0) {
        // Format as concise formula: "Good day → Sleep 6-8h → Romance 2h → ..."
        const description = `${boolEvent.name} → ${trueOutcomes.join(' → ')}`;
        patterns.push({
          description,
          confidence: Math.min(95, 65 + trueOutcomes.length * 4),
          type: 'co-occurrence',
          events: trueRelatedEvents,
        });
      }
    }

    // 3. NUMBER THRESHOLD PATTERNS: High/low values and their correlations
    for (const { event: numEvent, dataPoints: numData } of numberEvents) {
      const numericValues = numData
        .filter(d => typeof d.value === 'number')
        .map(d => ({ date: d.date, value: d.value as number }));

      if (numericValues.length < 2) continue;

      const values = numericValues.map(d => d.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);

      // Skip if no variation
      if (max - min < 0.5) continue;

      // Define "high" as above average
      const threshold = avg;
      const highDates = numericValues.filter(d => d.value > threshold).map(d => d.date);
      const lowDates = numericValues.filter(d => d.value <= threshold).map(d => d.date);

      if (highDates.length < 1 || lowDates.length < 1) continue;

      const unit = numEvent.unit ? ` ${numEvent.unit}` : '';

      // HIGH pattern
      const highOutcomes: string[] = [];
      const highRelatedEvents: Event[] = [numEvent];

      // Check other number events
      for (const { event: otherNum, dataPoints: otherData } of numberEvents) {
        if (otherNum.id === numEvent.id) continue;

        const highValues = highDates
          .map(date => otherData.find(d => d.date === date))
          .filter(d => d && typeof d.value === 'number')
          .map(d => d!.value as number);

        const lowValues = lowDates
          .map(date => otherData.find(d => d.date === date))
          .filter(d => d && typeof d.value === 'number')
          .map(d => d!.value as number);

        if (highValues.length > 0 && lowValues.length > 0) {
          const avgHigh = highValues.reduce((a, b) => a + b, 0) / highValues.length;
          const avgLow = lowValues.reduce((a, b) => a + b, 0) / lowValues.length;
          const diff = Math.abs(avgHigh - avgLow);
          const percentDiff = avgLow > 0 ? (diff / avgLow) * 100 : 0;

          if (percentDiff > 5 || diff > 0.5) {
            highRelatedEvents.push(otherNum);
            const otherUnit = otherNum.unit ? ` ${otherNum.unit}` : '';
            highOutcomes.push(`${otherNum.name} ${avgHigh.toFixed(1)}${otherUnit}`);
          }
        }
      }

      // Check boolean events
      for (const { event: boolEv, dataPoints: boolDt } of booleanEvents) {
        const highBools = highDates
          .map(date => boolDt.find(d => d.date === date))
          .filter(d => d && typeof d.value === 'number')
          .map(d => d!.value as number);

        const lowBools = lowDates
          .map(date => boolDt.find(d => d.date === date))
          .filter(d => d && typeof d.value === 'number')
          .map(d => d!.value as number);

        if (highBools.length > 0 && lowBools.length > 0) {
          const highRate = (highBools.filter(v => v > 0.5).length / highBools.length) * 100;
          const lowRate = (lowBools.filter(v => v > 0.5).length / lowBools.length) * 100;
          const diff = highRate - lowRate;

          if (Math.abs(diff) > 10) {
            highRelatedEvents.push(boolEv);
            if (diff > 0) {
              const text = highRate >= 80 ? boolEv.name : `${boolEv.name} ${highRate.toFixed(0)}%`;
              highOutcomes.push(text);
            } else {
              const text = highRate <= 20 ? `No ${boolEv.name}` : `${boolEv.name} ${highRate.toFixed(0)}%`;
              highOutcomes.push(text);
            }
          }
        }
      }

      if (highOutcomes.length > 0) {
        const avgHigh = highDates
          .map(date => numData.find(d => d.date === date))
          .filter(d => d && typeof d.value === 'number')
          .map(d => d!.value as number)
          .reduce((a, b) => a + b, 0) / highDates.length;

        // Format as concise formula: "Sleep 7+h → Good day → Romance 2h → ..."
        const description = `${numEvent.name} ${threshold.toFixed(1)}+${unit} → ${highOutcomes.join(' → ')}`;
        patterns.push({
          description,
          confidence: Math.min(95, 65 + highOutcomes.length * 4),
          type: 'threshold',
          events: highRelatedEvents,
        });
      }
    }

    // Return ALL patterns sorted by confidence (no limit!)
    return patterns.sort((a, b) => b.confidence - a.confidence);
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

    // Get numeric and string events separately
    const numericEvents = chartData.filter((d) => d.event.type !== 'string' && d.dataPoints.length > 0);
    const stringEvents = chartData.filter((d) => d.event.type === 'string' && d.dataPoints.length > 0);

    if (numericEvents.length === 0 && stringEvents.length === 0) return null;

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

    // Calculate chart width based on number of data points for scrolling
    const dataPointsCount = combinedChartData.length;
    const minChartWidth = screenWidth - 64; // Account for padding
    const chartWidth = Math.max(minChartWidth, dataPointsCount * 3); // 3px per data point minimum

    return (
      <View className="bg-card border border-border rounded-lg p-4 mb-4">
        <Text className="font-semibold text-lg mb-2">All Events Combined</Text>
        <Text className="text-sm text-muted-foreground mb-4">
          Normalized view to see patterns (scrollable){stringEvents.length > 0 ? ' • Dashed lines = text events' : ''}
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
                  formatter={(value: any, name: string, props: any) => {
                    // Check if this is a string event
                    const isStringEvent = stringEvents.some(e => e.event.name === name);
                    if (isStringEvent && props.payload[`${name}_original`]) {
                      return [props.payload[`${name}_original`], name];
                    }
                    // For numeric events, show original value with unit
                    if (props.payload[`${name}_original`] !== undefined) {
                      const event = [...numericEvents, ...stringEvents].find(e => e.event.name === name);
                      const unit = event?.event.unit ? ` ${event.event.unit}` : '';
                      return [`${props.payload[`${name}_original`]}${unit}`, name];
                    }
                    return [value, name];
                  }}
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
                {stringEvents.map(({ event }) => (
                  <Line
                    key={event.id}
                    type="stepAfter"
                    dataKey={event.name}
                    stroke={event.color}
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: event.color }}
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
            {isAnalyzingPatterns ? (
              <View className="mb-6">
                <Text className="text-2xl font-bold mb-1">🔍 Discovered Patterns</Text>
                <Text className="text-muted-foreground mb-4">
                  Analyzing your data...
                </Text>

                {/* Shimmer loading effect */}
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className="bg-card border border-border rounded-lg p-4 mb-3 overflow-hidden"
                  >
                    <View className="flex-row items-center mb-3">
                      <View className="w-3 h-3 rounded-full bg-muted mr-2 animate-pulse" />
                      <View className="w-20 h-4 bg-muted rounded animate-pulse" />
                      <View className="w-3 h-3 rounded-full bg-muted mx-2 animate-pulse" />
                      <View className="w-20 h-4 bg-muted rounded animate-pulse" />
                    </View>
                    <View className="w-full h-4 bg-muted rounded mb-2 animate-pulse" />
                    <View className="w-3/4 h-4 bg-muted rounded mb-3 animate-pulse" />
                    <View className="flex-row items-center justify-between">
                      <View className="w-24 h-3 bg-muted rounded animate-pulse" />
                      <View className="w-20 h-3 bg-muted rounded animate-pulse" />
                    </View>
                  </View>
                ))}
              </View>
            ) : patterns.length > 0 ? (
              <View className="mb-6">
                <Text className="text-2xl font-bold mb-1">🔍 Discovered Patterns</Text>
                <Text className="text-muted-foreground mb-4">
                  Based on your tracked data
                </Text>

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
                        <View key={i} className="flex-row items-center flex-wrap">
                          {i > 0 && <Text className="text-muted-foreground mx-2">→</Text>}
                          <View
                            className="w-2 h-2 rounded-full mr-2"
                            style={{ backgroundColor: eventColor }}
                          />
                          <Text className="text-base">{mainText}</Text>
                          {percentText && (
                            <>
                              <Text className="text-muted-foreground mx-1">·</Text>
                              <Text className="text-base text-muted-foreground">{percentText}</Text>
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
                      <View className="flex-row flex-wrap items-center mb-3">
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
              </View>
            ) : (
              <View className="mb-6">
                <Text className="text-2xl font-bold mb-1">🔍 Discovered Patterns</Text>
                <Text className="text-muted-foreground mb-4">
                  No clear patterns found yet. Keep tracking to discover insights!
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}
