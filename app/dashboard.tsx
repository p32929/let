import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Icon } from '@/components/ui/icon';
import { Stack, router } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Dimensions, Pressable } from 'react-native';
import { useEventsStore } from '@/lib/stores/events-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEventValuesForDateRangeComplete } from '@/db/operations/events';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays, getDay, subMonths, addDays, isSameMonth, getDaysInMonth } from 'date-fns';
import type { Event } from '@/types/events';
import { isPlaceholderValue } from '@/lib/data-optimization';
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
  const [summaryStatsCache, setSummaryStatsCache] = React.useState<Record<string, SummaryStats[]>>({});
  const [weekComparisons, setWeekComparisons] = React.useState<WeekComparison[]>([]);
  const [monthComparisons, setMonthComparisons] = React.useState<MonthComparison[]>([]);
  const [overallConsistency, setOverallConsistency] = React.useState(0);
  const [trackingStreak, setTrackingStreak] = React.useState(0);
  const [dayOfWeekStats, setDayOfWeekStats] = React.useState<DayOfWeekStats[]>([]);
  const [heatmapData, setHeatmapData] = React.useState<{ date: string; count: number }[]>([]);
  const [topCorrelations, setTopCorrelations] = React.useState<TopCorrelation[]>([]);
  const [comparisonView, setComparisonView] = React.useState<'week' | 'month'>('week');
  const [summaryView, setSummaryView] = React.useState<'7days' | '15days' | '1month' | '6months'>('7days');
  const [milestones, setMilestones] = React.useState<Milestone[]>([]);
  const [showAllMilestones, setShowAllMilestones] = React.useState(false);
  const insets = useSafeAreaInsets();
  const [recommendations, setRecommendations] = React.useState<RecommendedAction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);

  React.useEffect(() => {
    loadDashboardData();
  }, [events]);

  React.useEffect(() => {
    loadSummaryData();
  }, [events, summaryView]);

  const loadSummaryData = async () => {
    if (events.length === 0) {
      return;
    }

    // Check cache first
    if (summaryStatsCache[summaryView]) {
      setSummaryStats(summaryStatsCache[summaryView]);
      return;
    }

    setIsSummaryLoading(true);

    try {
      const today = new Date();
      const daysToLoad = summaryView === '7days' ? 7
        : summaryView === '15days' ? 15
        : summaryView === '1month' ? 30
        : 180; // 6 months
      const startDate = format(subDays(today, daysToLoad - 1), 'yyyy-MM-dd');
      const todayStr = format(today, 'yyyy-MM-dd');

      const allEventData = await Promise.all(
        events.map(async (event) => {
          const dataPoints = await getEventValuesForDateRangeComplete(
            event.id,
            startDate,
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

        if (event.type === 'boolean') {
          const trueCount = dataPoints.filter(d => d.value === 'true' || d.value === '1').length;
          stat.completionRate = dataPoints.length > 0 ? (trueCount / dataPoints.length) * 100 : 0;

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

          // Trend data for sparkline
          const trendDays = Math.min(14, dataPoints.length);
          const last14Days = dataPoints.slice(-trendDays);
          stat.trendData = last14Days.map(d => (d.value === 'true' || d.value === '1') ? 1 : 0);

          // Consistency: percentage of days with data
          const trackedDays = dataPoints.filter(d => d.value === 'true' || d.value === 'false' || d.value === '1' || d.value === '0').length;
          stat.consistency = dataPoints.length > 0 ? (trackedDays / dataPoints.length) * 100 : 0;
        } else if (event.type === 'number') {
          const numericValues = dataPoints
            .map(d => parseFloat(d.value as string))
            .filter(v => !isNaN(v) && v > 0);

          if (numericValues.length > 0) {
            const sum = numericValues.reduce((a, b) => a + b, 0);
            stat.average = sum / numericValues.length;
            stat.total = sum;
          }

          // Trend data for sparkline
          const trendDays = Math.min(14, dataPoints.length);
          stat.trendData = dataPoints.slice(-trendDays).map(d => {
            const val = parseFloat(d.value as string);
            return isNaN(val) ? 0 : val;
          });

          // Consistency
          const trackedDays = dataPoints.filter(d => {
            const val = parseFloat(d.value as string);
            return !isNaN(val) && val >= 0;
          }).length;
          stat.consistency = dataPoints.length > 0 ? (trackedDays / dataPoints.length) * 100 : 0;
        } else if (event.type === 'string') {
          const stringValues = dataPoints
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
          const trackedDays = dataPoints.filter(d => {
            const val = d.value as string;
            return val && val.trim() !== '';
          }).length;
          stat.consistency = dataPoints.length > 0 ? (trackedDays / dataPoints.length) * 100 : 0;
        }

        return stat;
      });

      setSummaryStats(stats);
      setSummaryStatsCache(prev => ({ ...prev, [summaryView]: stats }));
    } catch (error) {
      console.error('Failed to load summary data:', error);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const loadDashboardData = async () => {
    if (events.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const today = new Date();

      // Use last 90 days for all dashboard data (reasonable range)
      const dataStartDate = format(subDays(today, 89), 'yyyy-MM-dd');
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

      // Calculate tracking streak (consecutive days with ALL events tracked)
      // Load last 90 days for each event and filter defaults
      const allEventValuesPromises = events.map(async (event) =>
        getEventValuesForDateRangeComplete(event.id, dataStartDate, todayStr, event.type)
      );

      const allEventValuesArrays = await Promise.all(allEventValuesPromises);

      // Flatten and filter out placeholder values (id === -1 means not actually tracked)
      const allValues = allEventValuesArrays.flat();
      const trackedValues = allValues.filter(val => !isPlaceholderValue(val));

      const valuesByDate = trackedValues.reduce((acc, val) => {
        if (!acc[val.date]) acc[val.date] = [];
        acc[val.date].push(val);
        return acc;
      }, {} as Record<string, any[]>);

      // Calculate streak starting from today going backwards (max 30 days)
      let streak = 0;

      for (let i = 0; i < 30; i++) {
        const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
        const dayValues = valuesByDate[dateStr] || [];

        // Check if all events have non-default values for this day
        const allTracked = events.every(event => {
          return dayValues.some(v => v.eventId === event.id);
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
        events
          .filter(event => event.type !== 'string') // Filter out string events
          .map(async (event) => {
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

              comparison.lastWeekAvg = lastWeekData.length > 0 ? (lastWeekTrue / lastWeekData.length) * 100 : 0;
              comparison.thisWeekAvg = thisWeekData.length > 0 ? (thisWeekTrue / thisWeekData.length) * 100 : 0;
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

            comparison.lastMonthAvg = lastMonthData.length > 0 ? (lastMonthTrue / lastMonthData.length) * 100 : 0;
            comparison.thisMonthAvg = thisMonthData.length > 0 ? (thisMonthTrue / thisMonthData.length) * 100 : 0;
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

      // Calculate best day of week (last 30 days)
      const dayStats: Record<number, { total: number; completed: number }> = {};
      for (let i = 0; i < 7; i++) {
        dayStats[i] = { total: 0, completed: 0 };
      }

      for (let i = 0; i < 30; i++) {
        const date = subDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayIndex = getDay(date);
        const dayValues = valuesByDate[dateStr] || [];

        events.forEach(event => {
          dayStats[dayIndex].total++;

          // Since valuesByDate only contains non-default values, if it exists, it's completed
          const hasValue = dayValues.some(v => v.eventId === event.id);
          if (hasValue) {
            dayStats[dayIndex].completed++;
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
      const heatmapDays = 84;
      const heatmap: { date: string; count: number }[] = [];

      for (let i = heatmapDays - 1; i >= 0; i--) {
        const date = subDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayValues = valuesByDate[dateStr] || [];

        // Since valuesByDate only contains non-default values, count is just the number of events with values
        const count = dayValues.length;

        heatmap.push({ date: dateStr, count });
      }
      setHeatmapData(heatmap);

      // Calculate stats for milestones - Use 90-day data we already loaded
      let maxStreak = 0;
      let totalEventCount = 0;
      let avgConsistency = 0;
      let trackingStreakValue = 0;

      const milestoneDays = 90;

      for (const event of events) {
        // Get only non-default event values for this event
        const eventValues = trackedValues.filter(v => v.eventId === event.id);

        // Calculate CURRENT streak (consecutive days from today backwards)
        let currentStreak = 0;
        for (let i = 0; i < milestoneDays; i++) {
          const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
          const hasValue = eventValues.some(v => v.date === dateStr);

          if (hasValue) {
            currentStreak++;
          } else {
            break;
          }
        }

        // Calculate MAX streak (best streak in the period)
        let tempStreak = 0;
        let bestStreak = currentStreak;

        for (let i = 0; i < milestoneDays; i++) {
          const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
          const hasValue = eventValues.some(v => v.date === dateStr);

          if (hasValue) {
            tempStreak++;
            bestStreak = Math.max(bestStreak, tempStreak);
          } else {
            tempStreak = 0;
          }
        }

        maxStreak = Math.max(maxStreak, bestStreak);

        // Count total DAYS with non-default events
        totalEventCount += eventValues.length;

        // Calculate consistency (days with non-default data / total days checked)
        const daysWithData = eventValues.length;
        avgConsistency += (daysWithData / milestoneDays) * 100;
      }

      avgConsistency = events.length > 0 ? avgConsistency / events.length : 0;

      // Calculate tracking streak (days where ALL events have non-default values)
      if (events.length > 0) {
        for (let i = 0; i < milestoneDays; i++) {
          const dateStr = format(subDays(today, i), 'yyyy-MM-dd');

          const allEventsTracked = events.every(event => {
            return trackedValues.some(v => v.eventId === event.id && v.date === dateStr);
          });

          if (allEventsTracked) {
            trackingStreakValue++;
          } else {
            break;
          }
        }
      }

      setTrackingStreak(trackingStreakValue);

      // Generate ALL milestones (both achieved and unachieved)
      const generatedMilestones: Milestone[] = [
        // Streak Milestones
        {
          title: 'First Steps',
          description: maxStreak >= 3
            ? 'Started your journey!'
            : 'Maintain a 3-day streak',
          icon: FlameIcon,
          color: '#fbbf24',
          achieved: maxStreak >= 3,
        },
        {
          title: 'Week Warrior',
          description: maxStreak >= 7
            ? `${maxStreak}-day streak!`
            : 'Maintain a 7-day streak',
          icon: FlameIcon,
          color: '#f97316',
          achieved: maxStreak >= 7,
        },
        {
          title: 'Two Weeks Strong',
          description: maxStreak >= 14
            ? 'Two weeks of consistency!'
            : 'Maintain a 14-day streak',
          icon: FlameIcon,
          color: '#ea580c',
          achieved: maxStreak >= 14,
        },
        {
          title: 'Monthly Master',
          description: maxStreak >= 30
            ? 'A full month streak!'
            : 'Reach a 30-day streak',
          icon: TrophyIcon,
          color: '#f59e0b',
          achieved: maxStreak >= 30,
        },
        {
          title: 'Quarter Champion',
          description: maxStreak >= 90
            ? '90 days of excellence!'
            : 'Reach a 90-day streak',
          icon: TrophyIcon,
          color: '#d97706',
          achieved: maxStreak >= 90,
        },
        {
          title: 'Half Year Hero',
          description: maxStreak >= 180
            ? 'Six months strong!'
            : 'Reach a 180-day streak',
          icon: TrophyIcon,
          color: '#c2410c',
          achieved: maxStreak >= 180,
        },
        {
          title: 'Year Long Legend',
          description: maxStreak >= 365
            ? 'A full year streak!'
            : 'Reach a 365-day streak',
          icon: TrophyIcon,
          color: '#b91c1c',
          achieved: maxStreak >= 365,
        },

        // Consistency Milestones
        {
          title: 'Getting Started',
          description: avgConsistency >= 50
            ? `${avgConsistency.toFixed(0)}% consistent`
            : 'Reach 50% consistency',
          icon: ZapIcon,
          color: '#94a3b8',
          achieved: avgConsistency >= 50,
        },
        {
          title: 'Building Habits',
          description: avgConsistency >= 70
            ? `${avgConsistency.toFixed(0)}% consistent`
            : 'Reach 70% consistency',
          icon: ZapIcon,
          color: '#64748b',
          achieved: avgConsistency >= 70,
        },
        {
          title: 'Consistency Pro',
          description: avgConsistency >= 80
            ? `${avgConsistency.toFixed(0)}% consistent`
            : 'Reach 80% consistency',
          icon: ZapIcon,
          color: '#06b6d4',
          achieved: avgConsistency >= 80,
        },
        {
          title: 'Consistency Champion',
          description: avgConsistency >= 90
            ? `${avgConsistency.toFixed(0)}% consistent`
            : 'Reach 90% consistency',
          icon: ZapIcon,
          color: '#3b82f6',
          achieved: avgConsistency >= 90,
        },
        {
          title: 'Perfect Tracker',
          description: avgConsistency >= 95
            ? `${avgConsistency.toFixed(0)}% consistent!`
            : 'Reach 95% consistency',
          icon: ZapIcon,
          color: '#2563eb',
          achieved: avgConsistency >= 95,
        },

        // Total Events Milestones
        {
          title: 'Getting Active',
          description: totalEventCount >= 50
            ? '50+ events logged'
            : 'Log 50 total events',
          icon: AwardIcon,
          color: '#a78bfa',
          achieved: totalEventCount >= 50,
        },
        {
          title: 'Century Club',
          description: totalEventCount >= 100
            ? '100+ events logged'
            : 'Log 100 total events',
          icon: AwardIcon,
          color: '#8b5cf6',
          achieved: totalEventCount >= 100,
        },
        {
          title: 'Quarter Thousand',
          description: totalEventCount >= 250
            ? '250+ events logged'
            : 'Log 250 total events',
          icon: AwardIcon,
          color: '#7c3aed',
          achieved: totalEventCount >= 250,
        },
        {
          title: 'Half Thousand',
          description: totalEventCount >= 500
            ? '500+ events logged!'
            : 'Log 500 total events',
          icon: AwardIcon,
          color: '#6d28d9',
          achieved: totalEventCount >= 500,
        },
        {
          title: 'Thousand Club',
          description: totalEventCount >= 1000
            ? '1000+ events logged!'
            : 'Log 1000 total events',
          icon: AwardIcon,
          color: '#5b21b6',
          achieved: totalEventCount >= 1000,
        },

        // Tracking Streak Milestones
        {
          title: 'Full Day Tracker',
          description: trackingStreakValue >= 1
            ? 'Tracked everything today!'
            : 'Track all events for 1 day',
          icon: CheckCircle2Icon,
          color: '#86efac',
          achieved: trackingStreakValue >= 1,
        },
        {
          title: 'Complete Tracker',
          description: trackingStreakValue >= 7
            ? `${trackingStreakValue} days of full tracking`
            : 'Track all events for 7 days',
          icon: CheckCircle2Icon,
          color: '#22c55e',
          achieved: trackingStreakValue >= 7,
        },
        {
          title: 'Dedicated Logger',
          description: trackingStreakValue >= 14
            ? `${trackingStreakValue} days complete!`
            : 'Track all events for 14 days',
          icon: CheckCircle2Icon,
          color: '#16a34a',
          achieved: trackingStreakValue >= 14,
        },
        {
          title: 'Tracking Master',
          description: trackingStreakValue >= 30
            ? `${trackingStreakValue} days complete!`
            : 'Track all events for 30 days',
          icon: CheckCircle2Icon,
          color: '#15803d',
          achieved: trackingStreakValue >= 30,
        },
      ];

      // Sort milestones: achieved first, then unachieved
      const sortedMilestones = generatedMilestones.sort((a, b) => {
        if (a.achieved === b.achieved) return 0;
        return a.achieved ? -1 : 1;
      });

      setMilestones(sortedMilestones);

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
      summaryStats.forEach(stat => {
        if (stat.currentStreak && stat.currentStreak >= 3 && stat.currentStreak < (stat.bestStreak || 0)) {
          recs.push({
            action: `Keep ${stat.eventName} streak going`,
            reason: `You're at ${stat.currentStreak} days. Your record is ${stat.bestStreak}.`,
            confidence: (stat.currentStreak / (stat.bestStreak || 1)) * 100,
          });
        }
      });

      setRecommendations(recs);

      // Top correlations
      const correlations: TopCorrelation[] = [];

      const highPerformers = summaryStats.filter(s => (s.completionRate || 0) > 70 || (s.average || 0) > 0);
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
        <ScrollView
          className="flex-1 p-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
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
      <ScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Milestones */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Icon as={TrophyIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
              <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
                Milestones
              </Text>
            </View>
            {milestones.length > 4 && (
              <Pressable onPress={() => setShowAllMilestones(!showAllMilestones)}>
                <Text className="text-sm text-[#3b82f6] dark:text-[#60a5fa]">
                  {showAllMilestones ? 'Show Less' : `Show All (${milestones.length})`}
                </Text>
              </Pressable>
            )}
          </View>
          <View className="flex-row flex-wrap gap-3">
            {(showAllMilestones ? milestones : milestones.slice(0, 4)).map((milestone, index) => (
              <View
                key={index}
                className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-3 flex-row items-center"
                style={{
                  width: (screenWidth - 40) / 2 - 6,
                  opacity: milestone.achieved ? 1 : 0.4
                }}
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

        {/* Comparisons with Tabs */}
        {(weekComparisons.length > 0 || monthComparisons.filter(c => c.eventType !== 'string').length > 0) && (
          <View className="mb-6">
            {/* Tab Buttons */}
            <View className="flex-row gap-2 mb-3">
              <Pressable
                onPress={() => setComparisonView('week')}
                className={`flex-1 py-3 px-4 rounded-lg ${
                  comparisonView === 'week'
                    ? 'bg-[#0a0a0a] dark:bg-[#fafafa]'
                    : 'bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626]'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    comparisonView === 'week'
                      ? 'text-white dark:text-[#0a0a0a]'
                      : 'text-[#737373] dark:text-[#a3a3a3]'
                  }`}
                >
                  Week
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setComparisonView('month')}
                className={`flex-1 py-3 px-4 rounded-lg ${
                  comparisonView === 'month'
                    ? 'bg-[#0a0a0a] dark:bg-[#fafafa]'
                    : 'bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626]'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    comparisonView === 'month'
                      ? 'text-white dark:text-[#0a0a0a]'
                      : 'text-[#737373] dark:text-[#a3a3a3]'
                  }`}
                >
                  Month
                </Text>
              </Pressable>
            </View>

            {/* Week Comparison */}
            {comparisonView === 'week' && weekComparisons.length > 0 && (
              <View>
                <View className="flex-row items-center mb-3">
                  <Icon as={TrendingUpIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
                  <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
                    This Week vs Last Week
                  </Text>
                </View>
                <View className="gap-3">
                  {weekComparisons.map((comp, index) => (
                    <View
                      key={index}
                      className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-4"
                      style={{ borderLeftWidth: 4, borderLeftColor: comp.color }}
                    >
                      <Text className="text-base font-semibold text-[#0a0a0a] dark:text-[#fafafa] mb-2">
                        {comp.eventName}
                      </Text>
                      <View className="gap-2">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">Last Week</Text>
                          <Text className="text-base text-[#0a0a0a] dark:text-[#fafafa]">
                            {comp.lastWeekAvg?.toFixed(1)}{comp.eventType === 'boolean' ? '%' : ''}
                          </Text>
                        </View>
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm text-[#737373] dark:text-[#a3a3a3]">This Week</Text>
                          <Text className="text-base text-[#0a0a0a] dark:text-[#fafafa]">
                            {comp.thisWeekAvg?.toFixed(1)}{comp.eventType === 'boolean' ? '%' : ''}
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
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Month Comparison */}
            {comparisonView === 'month' && monthComparisons.filter(c => c.eventType !== 'string').length > 0 && (
              <View>
                <View className="flex-row items-center mb-3">
                  <Icon as={CalendarIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
                  <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
                    This Month vs Last Month
                  </Text>
                </View>
                <View className="gap-3">
                  {monthComparisons.filter(c => c.eventType !== 'string').map((comp, index) => (
                    <View
                      key={index}
                      className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-4"
                      style={{ borderLeftWidth: 4, borderLeftColor: comp.color }}
                    >
                      <Text className="text-base font-semibold text-[#0a0a0a] dark:text-[#fafafa] mb-2">
                        {comp.eventName}
                      </Text>
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
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
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

        {/* Summary Stats with Trends & Sparklines */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Icon as={ActivityIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
            <Text className="text-lg font-bold text-[#0a0a0a] dark:text-[#fafafa]">
              Summary
            </Text>
          </View>

          {/* Summary Time Range Tabs */}
          <View className="flex-row gap-2 mb-3">
            <Pressable
              onPress={() => setSummaryView('7days')}
              className={`flex-1 py-2 px-3 rounded-lg ${
                summaryView === '7days'
                  ? 'bg-[#0a0a0a] dark:bg-[#fafafa]'
                  : 'bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626]'
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  summaryView === '7days'
                    ? 'text-white dark:text-[#0a0a0a]'
                    : 'text-[#737373] dark:text-[#a3a3a3]'
                }`}
              >
                7d
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSummaryView('15days')}
              className={`flex-1 py-2 px-3 rounded-lg ${
                summaryView === '15days'
                  ? 'bg-[#0a0a0a] dark:bg-[#fafafa]'
                  : 'bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626]'
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  summaryView === '15days'
                    ? 'text-white dark:text-[#0a0a0a]'
                    : 'text-[#737373] dark:text-[#a3a3a3]'
                }`}
              >
                15d
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSummaryView('1month')}
              className={`flex-1 py-2 px-3 rounded-lg ${
                summaryView === '1month'
                  ? 'bg-[#0a0a0a] dark:bg-[#fafafa]'
                  : 'bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626]'
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  summaryView === '1month'
                    ? 'text-white dark:text-[#0a0a0a]'
                    : 'text-[#737373] dark:text-[#a3a3a3]'
                }`}
              >
                1m
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSummaryView('6months')}
              className={`flex-1 py-2 px-3 rounded-lg ${
                summaryView === '6months'
                  ? 'bg-[#0a0a0a] dark:bg-[#fafafa]'
                  : 'bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626]'
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  summaryView === '6months'
                    ? 'text-white dark:text-[#0a0a0a]'
                    : 'text-[#737373] dark:text-[#a3a3a3]'
                }`}
              >
                6m
              </Text>
            </Pressable>
          </View>

          {isSummaryLoading ? (
            <View className="gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </View>
          ) : (
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
          )}
        </View>
      </ScrollView>
    </View>
  );
}
