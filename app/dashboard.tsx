import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Icon } from '@/components/ui/icon';
import { Stack, router } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Dimensions, Pressable } from 'react-native';
import { useEventsStore } from '@/lib/stores/events-store';
import { getEventValuesForDateRangeComplete, getAllEventValues } from '@/db/operations/events';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays, getDay, subMonths } from 'date-fns';
import type { Event } from '@/types/events';
import { TrendingUpIcon, TrendingDownIcon, TargetIcon, CalendarIcon, AwardIcon, ActivityIcon, CheckCircle2Icon, ZapIcon, TrophyIcon, SparklesIcon, FlameIcon, AlertCircleIcon } from 'lucide-react-native';
import Svg, { Rect, Line as SvgLine, Circle, Path, Text as SvgText } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;

interface EventDataPoint {
  date: string;
  value: number | string;
}

interface SummaryStats {
  eventName: string;
  eventType: 'boolean' | 'number' | 'string';
  color: string;
  unit?: string;
  average?: number;
  total?: number;
  completionRate?: number;
  currentStreak?: number;
  bestStreak?: number;
  mostCommon?: string;
  trendData?: number[]; // For sparkline
  consistency?: number; // Percentage of days tracked
}

interface WeekComparison {
  eventName: string;
  eventType: 'boolean' | 'number' | 'string';
  color: string;
  lastWeekAvg?: number;
  thisWeekAvg?: number;
  change?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'stable';
}

interface MonthComparison {
  eventName: string;
  eventType: 'boolean' | 'number' | 'string';
  color: string;
  lastMonthAvg?: number;
  thisMonthAvg?: number;
  change?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'stable';
}

interface DayOfWeekStats {
  day: string;
  dayIndex: number;
  completionRate: number;
}

interface TopCorrelation {
  description: string;
  confidence: number;
  events: Event[];
}

interface Milestone {
  title: string;
  description: string;
  icon: any;
  color: string;
  achieved: boolean;
}

interface RecommendedAction {
  action: string;
  reason: string;
  confidence: number;
}

// Simple sparkline component
const Sparkline = ({ data, width = 60, height = 20, color = '#3b82f6' }: { data: number[]; width?: number; height?: number; color?: string }) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <Svg width={width} height={height}>
      <Path
        d={`M ${points}`}
        stroke={color}
        strokeWidth="2"
        fill="none"
      />
    </Svg>
  );
};

// Heatmap component
const ActivityHeatmap = ({ data }: { data: { date: string; count: number }[] }) => {
  const cellSize = 12;
  const cellGap = 3;
  const weeksToShow = 12;

  // Group by weeks
  const weeks: { date: string; count: number }[][] = [];
  let currentWeek: { date: string; count: number }[] = [];

  data.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === data.length - 1) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  const displayWeeks = weeks.slice(-weeksToShow);
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getColor = (count: number) => {
    if (count === 0) return '#e5e5e5';
    const intensity = count / maxCount;
    if (intensity > 0.75) return '#22c55e';
    if (intensity > 0.5) return '#84cc16';
    if (intensity > 0.25) return '#fbbf24';
    return '#f97316';
  };

  const svgWidth = displayWeeks.length * (cellSize + cellGap);
  const svgHeight = 7 * (cellSize + cellGap);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={svgWidth} height={svgHeight}>
        {displayWeeks.map((week, weekIndex) => (
          week.map((day, dayIndex) => (
            <Rect
              key={`${weekIndex}-${dayIndex}`}
              x={weekIndex * (cellSize + cellGap)}
              y={dayIndex * (cellSize + cellGap)}
              width={cellSize}
              height={cellSize}
              fill={getColor(day.count)}
              rx={2}
            />
          ))
        ))}
      </Svg>
    </ScrollView>
  );
};

export default function DashboardScreen() {
  const { events } = useEventsStore();
  const [summaryStats, setSummaryStats] = React.useState<SummaryStats[]>([]);
  const [weekComparisons, setWeekComparisons] = React.useState<WeekComparison[]>([]);
  const [monthComparisons, setMonthComparisons] = React.useState<MonthComparison[]>([]);
  const [overallConsistency, setOverallConsistency] = React.useState(0);
  const [trackingStreak, setTrackingStreak] = React.useState(0);
  const [dayOfWeekStats, setDayOfWeekStats] = React.useState<DayOfWeekStats[]>([]);
  const [heatmapData, setHeatmapData] = React.useState<{ date: string; count: number }[]>([]);
  const [topCorrelations, setTopCorrelations] = React.useState<TopCorrelation[]>([]);
  const [milestones, setMilestones] = React.useState<Milestone[]>([]);
  const [recommendations, setRecommendations] = React.useState<RecommendedAction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    loadDashboardData();
  }, [events]);

  const loadDashboardData = async () => {
    if (events.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const today = new Date();
      const ninetyDaysAgo = format(subDays(today, 90), 'yyyy-MM-dd');
      const todayStr = format(today, 'yyyy-MM-dd');

      // Get this week, last week, this month, last month dates
      const thisWeekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const thisWeekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const lastWeekStart = format(startOfWeek(subDays(today, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const lastWeekEnd = format(endOfWeek(subDays(today, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const thisMonthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const thisMonthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
      const lastMonthStart = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
      const lastMonthEnd = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');

      // Load all event data for 90 days
      const allEventData = await Promise.all(
        events.map(async (event) => {
          const dataPoints = await getEventValuesForDateRangeComplete(
            event.id,
            ninetyDaysAgo,
            todayStr,
            event.type
          );
          return { event, dataPoints };
        })
      );

      // Calculate summary stats with trends
      const stats: SummaryStats[] = allEventData.map(({ event, dataPoints }) => {
        const stat: SummaryStats = {
          eventName: event.name,
          eventType: event.type,
          color: event.color,
          unit: event.unit || undefined,
        };

        // Last 30 days for main stats
        const last30Days = dataPoints.slice(-30);

        if (event.type === 'boolean') {
          const trueCount = last30Days.filter(d => d.value === 'true' || d.value === '1').length;
          stat.completionRate = (trueCount / last30Days.length) * 100;

          // Calculate streaks
          let currentStreak = 0;
          let bestStreak = 0;
          let tempStreak = 0;

          for (let i = dataPoints.length - 1; i >= 0; i--) {
            if (dataPoints[i].value === 'true' || dataPoints[i].value === '1') {
              tempStreak++;
              if (i === dataPoints.length - 1 || currentStreak > 0) {
                currentStreak = tempStreak;
              }
              bestStreak = Math.max(bestStreak, tempStreak);
            } else {
              if (i === dataPoints.length - 1) {
                currentStreak = 0;
              }
              tempStreak = 0;
            }
          }

          stat.currentStreak = currentStreak;
          stat.bestStreak = bestStreak;

          // Trend data for sparkline (last 14 days)
          const last14Days = dataPoints.slice(-14);
          stat.trendData = last14Days.map(d => (d.value === 'true' || d.value === '1') ? 1 : 0);

          // Consistency: percentage of days with data
          const trackedDays = last30Days.filter(d => d.value === 'true' || d.value === 'false' || d.value === '1' || d.value === '0').length;
          stat.consistency = (trackedDays / last30Days.length) * 100;
        } else if (event.type === 'number') {
          const numericValues = last30Days
            .map(d => parseFloat(d.value as string))
            .filter(v => !isNaN(v) && v > 0);

          if (numericValues.length > 0) {
            const sum = numericValues.reduce((a, b) => a + b, 0);
            stat.average = sum / numericValues.length;
            stat.total = sum;
          }

          // Trend data for sparkline (last 14 days)
          stat.trendData = dataPoints.slice(-14).map(d => {
            const val = parseFloat(d.value as string);
            return isNaN(val) ? 0 : val;
          });

          // Consistency
          const trackedDays = last30Days.filter(d => {
            const val = parseFloat(d.value as string);
            return !isNaN(val) && val >= 0;
          }).length;
          stat.consistency = (trackedDays / last30Days.length) * 100;
        } else if (event.type === 'string') {
          const stringValues = last30Days
            .map(d => d.value as string)
            .filter(v => v && v.trim() !== '');

          if (stringValues.length > 0) {
            const frequency = stringValues.reduce((acc, val) => {
              acc[val] = (acc[val] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            const mostCommon = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0];
            stat.mostCommon = mostCommon ? `${mostCommon[0]} (${mostCommon[1]}x)` : undefined;
          }

          // Consistency
          const trackedDays = last30Days.filter(d => {
            const val = d.value as string;
            return val && val.trim() !== '';
          }).length;
          stat.consistency = (trackedDays / last30Days.length) * 100;
        }

        return stat;
      });

      setSummaryStats(stats);

      // Calculate overall consistency score
      const avgConsistency = stats.reduce((sum, s) => sum + (s.consistency || 0), 0) / stats.length;
      setOverallConsistency(avgConsistency);

      // Calculate tracking streak (consecutive days with ALL events tracked)
      let streak = 0;
      const allValues = await getAllEventValues();
      const valuesByDate = allValues.reduce((acc, val) => {
        if (!acc[val.date]) acc[val.date] = [];
        acc[val.date].push(val);
        return acc;
      }, {} as Record<string, any[]>);

      for (let i = 0; i < 90; i++) {
        const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
        const dayValues = valuesByDate[dateStr] || [];

        // Check if all events are tracked for this day
        const allTracked = events.every(event => {
          const eventValue = dayValues.find(v => v.eventId === event.id);
          if (!eventValue) return false;

          if (event.type === 'boolean') {
            return eventValue.value === 'true' || eventValue.value === 'false';
          } else if (event.type === 'number') {
            const val = parseFloat(eventValue.value);
            return !isNaN(val);
          } else {
            return eventValue.value && eventValue.value.trim() !== '';
          }
        });

        if (allTracked) {
          if (i === 0 || streak > 0) {
            streak++;
          }
        } else {
          if (i === 0) break;
          if (streak > 0) break;
        }
      }
      setTrackingStreak(streak);

      // Calculate week comparisons
      const weekComps: WeekComparison[] = await Promise.all(
        events.map(async (event) => {
          const lastWeekData = await getEventValuesForDateRangeComplete(
            event.id,
            lastWeekStart,
            lastWeekEnd,
            event.type
          );
          const thisWeekData = await getEventValuesForDateRangeComplete(
            event.id,
            thisWeekStart,
            thisWeekEnd,
            event.type
          );

          const comparison: WeekComparison = {
            eventName: event.name,
            eventType: event.type,
            color: event.color,
            trend: 'stable',
          };

          if (event.type === 'boolean') {
            const lastWeekTrue = lastWeekData.filter(d => d.value === 'true' || d.value === '1').length;
            const thisWeekTrue = thisWeekData.filter(d => d.value === 'true' || d.value === '1').length;

            comparison.lastWeekAvg = (lastWeekTrue / lastWeekData.length) * 100;
            comparison.thisWeekAvg = (thisWeekTrue / thisWeekData.length) * 100;
            comparison.change = comparison.thisWeekAvg - comparison.lastWeekAvg;
            comparison.changePercent = comparison.lastWeekAvg > 0
              ? (comparison.change / comparison.lastWeekAvg) * 100
              : 0;
          } else if (event.type === 'number') {
            const lastWeekNums = lastWeekData
              .map(d => parseFloat(d.value as string))
              .filter(v => !isNaN(v) && v > 0);
            const thisWeekNums = thisWeekData
              .map(d => parseFloat(d.value as string))
              .filter(v => !isNaN(v) && v > 0);

            if (lastWeekNums.length > 0 && thisWeekNums.length > 0) {
              comparison.lastWeekAvg = lastWeekNums.reduce((a, b) => a + b, 0) / lastWeekNums.length;
              comparison.thisWeekAvg = thisWeekNums.reduce((a, b) => a + b, 0) / thisWeekNums.length;
              comparison.change = comparison.thisWeekAvg - comparison.lastWeekAvg;
              comparison.changePercent = comparison.lastWeekAvg > 0
                ? (comparison.change / comparison.lastWeekAvg) * 100
                : 0;
            }
          }

          // Determine trend
          if (comparison.change !== undefined) {
            if (Math.abs(comparison.change) < 0.01) {
              comparison.trend = 'stable';
            } else if (comparison.change > 0) {
              comparison.trend = 'up';
            } else {
              comparison.trend = 'down';
            }
          }

          return comparison;
        })
      );
      setWeekComparisons(weekComps);

      // Calculate month comparisons
      const monthComps: MonthComparison[] = await Promise.all(
        events.map(async (event) => {
          const lastMonthData = await getEventValuesForDateRangeComplete(
            event.id,
            lastMonthStart,
            lastMonthEnd,
            event.type
          );
          const thisMonthData = await getEventValuesForDateRangeComplete(
            event.id,
            thisMonthStart,
            thisMonthEnd,
            event.type
          );

          const comparison: MonthComparison = {
            eventName: event.name,
            eventType: event.type,
            color: event.color,
            trend: 'stable',
          };

          if (event.type === 'boolean') {
            const lastMonthTrue = lastMonthData.filter(d => d.value === 'true' || d.value === '1').length;
            const thisMonthTrue = thisMonthData.filter(d => d.value === 'true' || d.value === '1').length;

            comparison.lastMonthAvg = (lastMonthTrue / lastMonthData.length) * 100;
            comparison.thisMonthAvg = (thisMonthTrue / thisMonthData.length) * 100;
            comparison.change = comparison.thisMonthAvg - comparison.lastMonthAvg;
            comparison.changePercent = comparison.lastMonthAvg > 0
              ? (comparison.change / comparison.lastMonthAvg) * 100
              : 0;
          } else if (event.type === 'number') {
            const lastMonthNums = lastMonthData
              .map(d => parseFloat(d.value as string))
              .filter(v => !isNaN(v) && v > 0);
            const thisMonthNums = thisMonthData
              .map(d => parseFloat(d.value as string))
              .filter(v => !isNaN(v) && v > 0);

            if (lastMonthNums.length > 0 && thisMonthNums.length > 0) {
              comparison.lastMonthAvg = lastMonthNums.reduce((a, b) => a + b, 0) / lastMonthNums.length;
              comparison.thisMonthAvg = thisMonthNums.reduce((a, b) => a + b, 0) / thisMonthNums.length;
              comparison.change = comparison.thisMonthAvg - comparison.lastMonthAvg;
              comparison.changePercent = comparison.lastMonthAvg > 0
                ? (comparison.change / comparison.lastMonthAvg) * 100
                : 0;
            }
          }

          // Determine trend
          if (comparison.change !== undefined) {
            if (Math.abs(comparison.change) < 0.01) {
              comparison.trend = 'stable';
            } else if (comparison.change > 0) {
              comparison.trend = 'up';
            } else {
              comparison.trend = 'down';
            }
          }

          return comparison;
        })
      );
      setMonthComparisons(monthComps);

      // Calculate best day of week
      const dayStats: Record<number, { total: number; completed: number }> = {};
      for (let i = 0; i < 7; i++) {
        dayStats[i] = { total: 0, completed: 0 };
      }

      for (let i = 0; i < 90; i++) {
        const date = subDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayIndex = getDay(date);
        const dayValues = valuesByDate[dateStr] || [];

        events.forEach(event => {
          const eventValue = dayValues.find(v => v.eventId === event.id);
          dayStats[dayIndex].total++;

          if (eventValue) {
            if (event.type === 'boolean' && (eventValue.value === 'true' || eventValue.value === '1')) {
              dayStats[dayIndex].completed++;
            } else if (event.type === 'number') {
              const val = parseFloat(eventValue.value);
              if (!isNaN(val) && val > 0) {
                dayStats[dayIndex].completed++;
              }
            } else if (event.type === 'string' && eventValue.value && eventValue.value.trim() !== '') {
              dayStats[dayIndex].completed++;
            }
          }
        });
      }

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dowStats: DayOfWeekStats[] = Object.entries(dayStats).map(([dayIndex, stats]) => ({
        day: dayNames[parseInt(dayIndex)],
        dayIndex: parseInt(dayIndex),
        completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
      })).sort((a, b) => b.completionRate - a.completionRate);

      setDayOfWeekStats(dowStats);

      // Generate heatmap data (last 84 days = 12 weeks)
      const heatmap: { date: string; count: number }[] = [];
      for (let i = 83; i >= 0; i--) {
        const date = subDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayValues = valuesByDate[dateStr] || [];

        let count = 0;
        events.forEach(event => {
          const eventValue = dayValues.find(v => v.eventId === event.id);
          if (eventValue) {
            if (event.type === 'boolean' && (eventValue.value === 'true' || eventValue.value === '1')) {
              count++;
            } else if (event.type === 'number') {
              const val = parseFloat(eventValue.value);
              if (!isNaN(val) && val > 0) {
                count++;
              }
            } else if (event.type === 'string' && eventValue.value && eventValue.value.trim() !== '') {
              count++;
            }
          }
        });

        heatmap.push({ date: dateStr, count });
      }
      setHeatmapData(heatmap);

      // Generate milestones
      const generatedMilestones: Milestone[] = [];

      // Longest streak milestone
      const maxStreak = Math.max(...stats.map(s => s.bestStreak || 0));
      if (maxStreak >= 7) {
        generatedMilestones.push({
          title: '7-Day Streak',
          description: `Maintained a ${maxStreak}-day streak!`,
          icon: FlameIcon,
          color: '#f97316',
          achieved: true,
        });
      }
      if (maxStreak >= 30) {
        generatedMilestones.push({
          title: '30-Day Streak',
          description: 'Incredible consistency!',
          icon: TrophyIcon,
          color: '#f59e0b',
          achieved: true,
        });
      }

      // Tracking streak milestone
      if (trackingStreak >= 7) {
        generatedMilestones.push({
          title: 'Complete Tracker',
          description: `${trackingStreak} days of full tracking`,
          icon: CheckCircle2Icon,
          color: '#22c55e',
          achieved: true,
        });
      }

      // High consistency milestone
      if (avgConsistency >= 90) {
        generatedMilestones.push({
          title: 'Consistency Champion',
          description: `${avgConsistency.toFixed(0)}% tracking consistency`,
          icon: ZapIcon,
          color: '#3b82f6',
          achieved: true,
        });
      }

      // Total events milestone
      const totalEventCount = stats.reduce((sum, s) => sum + (s.total || 0), 0);
      if (totalEventCount >= 100) {
        generatedMilestones.push({
          title: 'Century Club',
          description: '100+ total events logged',
          icon: AwardIcon,
          color: '#8b5cf6',
          achieved: true,
        });
      }

      setMilestones(generatedMilestones);

      // Generate recommendations based on patterns
      const recs: RecommendedAction[] = [];

      // Best day recommendation
      if (dowStats.length > 0 && dowStats[0].completionRate > 70) {
        recs.push({
          action: `${dowStats[0].day} is your best day`,
          reason: `${dowStats[0].completionRate.toFixed(0)}% completion rate. Schedule important tasks on ${dowStats[0].day}s.`,
          confidence: dowStats[0].completionRate,
        });
      }

      // Consistency recommendation
      if (avgConsistency < 80) {
        recs.push({
          action: 'Improve tracking consistency',
          reason: `Currently at ${avgConsistency.toFixed(0)}%. Try setting daily reminders.`,
          confidence: 100 - avgConsistency,
        });
      }

      // Streak opportunity
      stats.forEach(stat => {
        if (stat.currentStreak && stat.currentStreak >= 3 && stat.currentStreak < (stat.bestStreak || 0)) {
          recs.push({
            action: `Keep ${stat.eventName} streak going`,
            reason: `You're at ${stat.currentStreak} days. Your record is ${stat.bestStreak}.`,
            confidence: (stat.currentStreak / (stat.bestStreak || 1)) * 100,
          });
        }
      });

      setRecommendations(recs);

      // Top correlations (simplified - just showing some example patterns)
      // In a real implementation, this would analyze actual correlations from patterns
      const correlations: TopCorrelation[] = [];

      // Find events with high completion rates
      const highPerformers = stats.filter(s => (s.completionRate || 0) > 70 || (s.average || 0) > 0);
      if (highPerformers.length >= 2) {
        correlations.push({
          description: `Strong habits: ${highPerformers.slice(0, 2).map(s => s.eventName).join(' and ')}`,
          confidence: Math.min(...highPerformers.slice(0, 2).map(s => s.completionRate || s.average || 0)),
          events: highPerformers.slice(0, 2).map(s => events.find(e => e.name === s.eventName)!).filter(Boolean),
        });
      }

      setTopCorrelations(correlations);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#fafafa] dark:bg-black">
        <Stack.Screen
          options={{
            title: 'Dashboard',
          }}
        />
        <ScrollView className="flex-1 p-4">
          <View className="gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View className="flex-1 bg-[#fafafa] dark:bg-black">
        <Stack.Screen
          options={{
            title: 'Dashboard',
          }}
        />
        <View className="flex-1 items-center justify-center p-8">
          <Icon as={ActivityIcon} className="size-16 text-[#a3a3a3] mb-4" />
          <Text className="text-xl font-semibold text-[#0a0a0a] dark:text-[#fafafa] text-center mb-2">
            No Events Yet
          </Text>
          <Text className="text-base text-[#737373] dark:text-[#a3a3a3] text-center">
            Start tracking events to see your analytics dashboard
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#fafafa] dark:bg-black">
      <Stack.Screen
        options={{
          title: 'Dashboard',
        }}
      />
      <ScrollView className="flex-1 p-4">
        {/* Overall Consistency & Tracking Streak */}
        <View className="mb-6">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-lg p-4">
              <View className="flex-row items-center mb-2">
                <Icon as={ZapIcon} className="size-5 text-white mr-2" />
                <Text className="text-sm font-semibold text-white opacity-90">Consistency</Text>
              </View>
              <Text className="text-3xl font-bold text-white mb-1">{overallConsistency.toFixed(0)}%</Text>
              <Text className="text-xs text-white opacity-75">Overall tracking rate</Text>
            </View>

            <View className="flex-1 bg-gradient-to-br from-[#f97316] to-[#ea580c] rounded-lg p-4">
              <View className="flex-row items-center mb-2">
                <Icon as={FlameIcon} className="size-5 text-white mr-2" />
                <Text className="text-sm font-semibold text-white opacity-90">Streak</Text>
              </View>
              <Text className="text-3xl font-bold text-white mb-1">{trackingStreak}</Text>
              <Text className="text-xs text-white opacity-75">days tracked</Text>
            </View>
          </View>
        </View>

        {/* Milestones */}
        {milestones.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center mb-3">
              <Icon as={TrophyIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
              <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
                Milestones
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-3">
              {milestones.map((milestone, index) => (
                <View
                  key={index}
                  className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-3 flex-row items-center"
                  style={{ width: (screenWidth - 40) / 2 - 6 }}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: milestone.color + '20' }}
                  >
                    <Icon as={milestone.icon} size={20} color={milestone.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-[#0a0a0a] dark:text-[#fafafa]">
                      {milestone.title}
                    </Text>
                    <Text className="text-xs text-[#737373] dark:text-[#a3a3a3]">
                      {milestone.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recommended Actions */}
        {recommendations.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center mb-3">
              <Icon as={SparklesIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
              <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
                Recommendations
              </Text>
            </View>
            <View className="gap-3">
              {recommendations.map((rec, index) => (
                <View
                  key={index}
                  className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-4"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <Text className="flex-1 text-base font-semibold text-[#0a0a0a] dark:text-[#fafafa] mr-2">
                      {rec.action}
                    </Text>
                    <View className="bg-[#22c55e]/10 px-2 py-1 rounded">
                      <Text className="text-xs font-semibold text-[#22c55e]">
                        {rec.confidence.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">
                    {rec.reason}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Activity Heatmap */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Icon as={CalendarIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
              <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
                Activity Heatmap
              </Text>
            </View>
            <Text className="text-xs text-[#737373] dark:text-[#a3a3a3]">Last 12 weeks</Text>
          </View>
          <View className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-4">
            <ActivityHeatmap data={heatmapData} />
            <View className="flex-row items-center justify-between mt-3">
              <Text className="text-xs text-[#737373] dark:text-[#a3a3a3]">Less</Text>
              <View className="flex-row gap-1">
                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#e5e5e5' }} />
                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f97316' }} />
                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#fbbf24' }} />
                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#84cc16' }} />
                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
              </View>
              <Text className="text-xs text-[#737373] dark:text-[#a3a3a3]">More</Text>
            </View>
          </View>
        </View>

        {/* Best Day of Week */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Icon as={TargetIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
            <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
              Best Days of Week
            </Text>
          </View>
          <View className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-4">
            {dayOfWeekStats.slice(0, 7).map((dayStat, index) => (
              <View key={index} className="mb-3 last:mb-0">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm font-medium text-[#0a0a0a] dark:text-[#fafafa]">
                    {dayStat.day}
                  </Text>
                  <Text className="text-sm font-semibold text-[#3b82f6]">
                    {dayStat.completionRate.toFixed(0)}%
                  </Text>
                </View>
                <View className="h-2 bg-[#e5e5e5] dark:bg-[#262626] rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${dayStat.completionRate}%`,
                      backgroundColor: index === 0 ? '#22c55e' : '#3b82f6',
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Summary Stats with Trends */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Icon as={ActivityIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
            <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
              Summary (Last 30 Days)
            </Text>
          </View>
          <View className="gap-3">
            {summaryStats.map((stat, index) => (
              <View
                key={index}
                className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-4"
                style={{ borderLeftWidth: 4, borderLeftColor: stat.color }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-[#0a0a0a] dark:text-[#fafafa]">
                    {stat.eventName}
                  </Text>
                  {stat.trendData && stat.trendData.length > 1 && (
                    <Sparkline data={stat.trendData} color={stat.color} />
                  )}
                </View>

                {stat.eventType === 'boolean' && (
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Completion Rate</Text>
                      <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
                        {stat.completionRate?.toFixed(0)}%
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Current Streak</Text>
                      <Text className="text-base font-semibold text-[#f97316]">
                        {stat.currentStreak} days
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Best Streak</Text>
                      <Text className="text-base font-semibold text-[#22c55e]">
                        {stat.bestStreak} days
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Consistency</Text>
                      <Text className="text-sm font-semibold text-[#3b82f6]">
                        {stat.consistency?.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                )}

                {stat.eventType === 'number' && (
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Average</Text>
                      <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
                        {stat.average?.toFixed(1)} {stat.unit}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Total</Text>
                      <Text className="text-base font-semibold text-[#3b82f6]">
                        {stat.total?.toFixed(1)} {stat.unit}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Consistency</Text>
                      <Text className="text-sm font-semibold text-[#3b82f6]">
                        {stat.consistency?.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                )}

                {stat.eventType === 'string' && stat.mostCommon && (
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Most Common</Text>
                      <Text className="text-base font-semibold text-[#0a0a0a] dark:text-[#fafafa]">
                        {stat.mostCommon}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Consistency</Text>
                      <Text className="text-sm font-semibold text-[#3b82f6]">
                        {stat.consistency?.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* This Month vs Last Month */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Icon as={CalendarIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
            <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
              This Month vs Last Month
            </Text>
          </View>
          <View className="gap-3">
            {monthComparisons.map((comp, index) => (
              <View
                key={index}
                className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-4"
                style={{ borderLeftWidth: 4, borderLeftColor: comp.color }}
              >
                <Text className="text-base font-semibold text-[#0a0a0a] dark:text-[#fafafa] mb-2">
                  {comp.eventName}
                </Text>

                {(comp.eventType === 'boolean' || comp.eventType === 'number') && (
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Last Month</Text>
                      <Text className="text-base text-[#0a0a0a] dark:text-[#fafafa]">
                        {comp.lastMonthAvg?.toFixed(1)}{comp.eventType === 'boolean' ? '%' : ''}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">This Month</Text>
                      <Text className="text-base text-[#0a0a0a] dark:text-[#fafafa]">
                        {comp.thisMonthAvg?.toFixed(1)}{comp.eventType === 'boolean' ? '%' : ''}
                      </Text>
                    </View>
                    {comp.change !== undefined && (
                      <View className="flex-row items-center justify-between mt-1 pt-2 border-t border-[#e5e5e5] dark:border-[#262626]">
                        <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Change</Text>
                        <View className="flex-row items-center gap-1">
                          {comp.trend === 'up' && (
                            <Icon as={TrendingUpIcon} className="size-4 text-[#22c55e]" />
                          )}
                          {comp.trend === 'down' && (
                            <Icon as={TrendingDownIcon} className="size-4 text-[#ef4444]" />
                          )}
                          <Text
                            className={`text-base font-semibold ${
                              comp.trend === 'up'
                                ? 'text-[#22c55e]'
                                : comp.trend === 'down'
                                ? 'text-[#ef4444]'
                                : 'text-[#737373] dark:text-[#a3a3a3]'
                            }`}
                          >
                            {comp.change > 0 ? '+' : ''}{comp.change.toFixed(1)}
                            {comp.eventType === 'boolean' ? '%' : ''}
                            {comp.changePercent !== undefined && comp.changePercent !== 0 && (
                              <Text className="text-sm"> ({comp.changePercent > 0 ? '+' : ''}{comp.changePercent.toFixed(0)}%)</Text>
                            )}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {comp.eventType === 'string' && (
                  <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">
                    String events don't have month comparisons
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Top Correlations */}
        {topCorrelations.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <Icon as={SparklesIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
                <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
                  Top Patterns
                </Text>
              </View>
              <Pressable onPress={() => router.push('/patterns' as any)}>
                <Text className="text-sm font-semibold text-[#3b82f6]">See All →</Text>
              </Pressable>
            </View>
            <View className="gap-3">
              {topCorrelations.map((corr, index) => (
                <View
                  key={index}
                  className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-4"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <Text className="flex-1 text-base font-semibold text-[#0a0a0a] dark:text-[#fafafa] mr-2">
                      {corr.description}
                    </Text>
                    <View className="bg-[#8b5cf6]/10 px-2 py-1 rounded">
                      <Text className="text-xs font-semibold text-[#8b5cf6]">
                        {corr.confidence.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    {corr.events.map((event, idx) => (
                      <View
                        key={idx}
                        className="px-2 py-1 rounded"
                        style={{ backgroundColor: event.color + '20' }}
                      >
                        <Text className="text-xs font-medium" style={{ color: event.color }}>
                          {event.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Personal Records */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Icon as={AwardIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
            <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
              Personal Records
            </Text>
          </View>
          <View className="gap-3">
            {summaryStats
              .filter(stat => stat.eventType === 'boolean' && stat.bestStreak && stat.bestStreak > 0)
              .sort((a, b) => (b.bestStreak || 0) - (a.bestStreak || 0))
              .slice(0, 5)
              .map((stat, index) => (
                <View
                  key={index}
                  className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-4 flex-row items-center justify-between"
                  style={{ borderLeftWidth: 4, borderLeftColor: stat.color }}
                >
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-[#0a0a0a] dark:text-[#fafafa]">
                      {stat.eventName}
                    </Text>
                    <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">
                      Longest Streak
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-2xl font-bold text-[#f59e0b]">
                      {stat.bestStreak}
                    </Text>
                    <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">
                      days
                    </Text>
                  </View>
                </View>
              ))}
            {summaryStats.filter(stat => stat.eventType === 'boolean' && stat.bestStreak && stat.bestStreak > 0).length === 0 && (
              <View className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-6 items-center">
                <Text className="text-sm text-[#737373] dark:text-[#a3a3a3] text-center">
                  No streaks yet. Keep tracking to build your records!
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
