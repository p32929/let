import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { Icon } from '@/components/ui/icon';
import { Stack } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useEventsStore } from '@/lib/stores/events-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEventValuesForDateRange } from '@/db/operations/events';
import { format, parseISO, subDays } from 'date-fns';
import { forecast, MIN_DAYS, type EventForecast } from '@/lib/forecast';
import { CalendarClockIcon, HourglassIcon } from 'lucide-react-native';

const card = 'bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg';
const title = 'text-[#0a0a0a] dark:text-[#fafafa]';
const muted = 'text-[#737373] dark:text-[#a3a3a3]';

// What to show as the main number for an event on a day.
function headline(f: EventForecast, i: number): string {
  const d = f.days[i];
  const chance = `${Math.round(d.probability * 100)}%`;
  if (f.event.type === 'boolean' || !d.expected) return chance;
  return d.probability >= 0.9 ? `~${d.expected}` : `${chance} · ~${d.expected}`;
}

export default function ForecastScreen() {
  const { events, loadEvents } = useEventsStore();
  const triedLoad = React.useRef(false);
  const insets = useSafeAreaInsets();
  const [forecasts, setForecasts] = React.useState<EventForecast[] | null>(null);
  const [selected, setSelected] = React.useState(0);

  React.useEffect(() => {
    if (events.length === 0) {
      // Opened directly (e.g. a web reload): load events once, then show what there is.
      if (!triedLoad.current) {
        triedLoad.current = true;
        loadEvents().then(() => {
          if (useEventsStore.getState().events.length === 0) setForecasts([]);
        });
      } else {
        setForecasts([]);
      }
      return;
    }
    const today = format(new Date(), 'yyyy-MM-dd');
    const start = format(subDays(new Date(), 130), 'yyyy-MM-dd');
    Promise.all(
      events.map(async event => ({ event, values: await getEventValuesForDateRange(event.id, start, today) }))
    )
      .then(inputs => setForecasts(forecast(inputs, today)))
      .catch(error => {
        console.error('Failed to build forecast:', error);
        setForecasts([]);
      });
  }, [events]);

  if (!forecasts) {
    return (
      <View className="flex-1 bg-[#fafafa] dark:bg-black p-4 gap-4">
        <Stack.Screen options={{ title: 'Forecast' }} />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
      </View>
    );
  }

  const ready = forecasts.filter(f => f.daysNeeded === 0);
  const waiting = forecasts.filter(f => f.daysNeeded > 0);
  const days = ready[0]?.days.map(d => d.date) ?? [];
  const sel = Math.min(selected, Math.max(0, days.length - 1));
  const dayRows = ready
    .map(f => ({ f, d: f.days[sel] }))
    .sort((a, b) => b.d.probability - a.d.probability);

  return (
    <View className="flex-1 bg-[#fafafa] dark:bg-black">
      <Stack.Screen options={{ title: 'Forecast' }} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        <View className="flex-row items-center mb-1">
          <Icon as={CalendarClockIcon} className="size-5 text-[#0a0a0a] dark:text-[#fafafa] mr-2" />
          <Text className={`text-lg font-bold ${title}`}>Next {days.length || 14} days</Text>
        </View>
        <Text className={`text-sm mb-4 ${muted}`}>
          A guess from your own history: the day of the week, your recent days, and things that repeat every few days. Stronger colour means more likely. Tap a day to see why.
        </Text>

        {ready.length === 0 ? (
          <View className={`${card} p-6 items-center mb-6`}>
            <Icon as={HourglassIcon} className="size-10 text-[#a3a3a3] mb-3" />
            <Text className={`text-base font-semibold text-center mb-1 ${title}`}>Not enough history yet</Text>
            <Text className={`text-sm text-center ${muted}`}>
              {forecasts.length === 0
                ? 'Add an event and track it for a while to see a forecast.'
                : `The forecast needs ${MIN_DAYS} days of tracking. Keep going for ${Math.min(...forecasts.map(f => f.daysNeeded))} more days.`}
            </Text>
          </View>
        ) : (
          <>
            {/* Day strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
              {days.map((date, i) => {
                const top = ready
                  .map(f => ({ color: f.event.color, p: f.days[i].probability }))
                  .sort((a, b) => b.p - a.p)
                  .slice(0, 5);
                const likely = ready.filter(f => f.days[i].probability >= 0.5).length;
                const active = i === sel;
                return (
                  <Pressable
                    key={date}
                    onPress={() => setSelected(i)}
                    className={`${card} items-center py-2 ${active ? 'border-2 border-[#0a0a0a] dark:border-[#fafafa]' : ''}`}
                    style={{ width: 64 }}
                  >
                    <Text className={`text-xs ${muted}`}>{format(parseISO(date), 'EEE')}</Text>
                    <Text className={`text-lg font-bold ${title}`}>{format(parseISO(date), 'd')}</Text>
                    <View className="gap-1 my-1">
                      {top.map((t, k) => (
                        <View key={k} style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.color, opacity: 0.1 + t.p * 0.9 }} />
                      ))}
                    </View>
                    <Text className={`text-[10px] ${muted}`}>{likely} likely</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Selected day */}
            <View className={`${card} p-4 mb-6`}>
              <Text className={`text-base font-bold mb-3 ${title}`}>
                {days[sel] ? format(parseISO(days[sel]), 'EEEE, MMMM d') : ''}
              </Text>
              <View className="gap-4">
                {dayRows.map(({ f, d }) => (
                  <View key={f.event.id} style={{ borderLeftWidth: 4, borderLeftColor: f.event.color }} className="pl-3">
                    <View className="flex-row items-center justify-between">
                      <Text className={`text-base font-semibold flex-1 mr-2 ${title}`} numberOfLines={1}>{f.event.name}</Text>
                      <Text className={`text-base font-bold ${title}`}>{headline(f, sel)}</Text>
                    </View>
                    <View className="h-1.5 rounded-full bg-[#f5f5f5] dark:bg-[#262626] my-1.5 overflow-hidden">
                      <View style={{ width: `${Math.round(d.probability * 100)}%`, height: '100%', backgroundColor: f.event.color }} />
                    </View>
                    <Text className={`text-sm ${muted}`}>{d.reason}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Past vs predicted */}
            <Text className={`text-lg font-bold mb-1 ${title}`}>Past vs predicted</Text>
            <View className="flex-row justify-between mb-2">
              <Text className={`text-xs ${muted}`}>Last 14 days (what happened)</Text>
              <Text className={`text-xs ${muted}`}>Next 14 days (chance)</Text>
            </View>
            <View className={`${card} p-4 mb-6 gap-3`}>
              {ready.map(f => {
                const max = Math.max(1, ...f.past.map(p => p.value));
                return (
                  <View key={f.event.id}>
                    <Text className={`text-xs mb-1 ${title}`} numberOfLines={1}>{f.event.name}</Text>
                    <View className="flex-row items-center" style={{ gap: 2 }}>
                      {f.past.map(p => (
                        <View key={p.date} className="flex-1 rounded-sm" style={{ height: 12, backgroundColor: f.event.color, opacity: p.value ? 0.15 + 0.85 * (p.value / max) : 0.08 }} />
                      ))}
                      <View style={{ width: 2, height: 16, marginHorizontal: 2 }} className="bg-[#0a0a0a] dark:bg-[#fafafa]" />
                      {f.days.map(d => (
                        <View key={d.date} className="flex-1 rounded-sm" style={{ height: 12, borderWidth: 1, borderColor: f.event.color, backgroundColor: f.event.color + Math.round(d.probability * 255).toString(16).padStart(2, '0') }} />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {waiting.length > 0 && (
          <View className={`${card} p-4`}>
            <Text className={`text-base font-bold mb-2 ${title}`}>Needs more history</Text>
            {waiting.map(f => (
              <Text key={f.event.id} className={`text-sm mb-1 ${muted}`}>
                {f.event.name}: track {f.daysNeeded} more {f.daysNeeded === 1 ? 'day' : 'days'} to see a forecast.
              </Text>
            ))}
          </View>
        )}

        <Text className={`text-xs mt-4 text-center ${muted}`}>
          A forecast is a guess from patterns, not a promise.
        </Text>
      </ScrollView>
    </View>
  );
}
