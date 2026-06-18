import * as React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { MinusIcon, PlusIcon, Settings2Icon } from 'lucide-react-native';
import type { Event } from '@/types/events';
import { getEventValue, setEventValue } from '@/db/operations/events';
import { formatDate } from '@/lib/date-utils';
import { router } from 'expo-router';

interface EventTrackerProps {
  event: Event;
  date: Date;
}

export function EventTracker({ event, date }: EventTrackerProps) {
  const [value, setValue] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(true);
  const dateStr = formatDate(date);

  // Mirror the current value in a ref so hold-to-repeat can read the latest
  // number without being stuck on a stale closure value.
  const valueRef = React.useRef(value);
  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Timer used while the +/- button is held down.
  const holdTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stopHold = React.useCallback(() => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);
  React.useEffect(() => stopHold, [stopHold]);

  // Load existing value
  React.useEffect(() => {
    const loadValue = async () => {
      setIsLoading(true);
      try {
        const eventValue = await getEventValue(event.id, dateStr);
        if (eventValue) {
          setValue(eventValue.value);
        } else {
          // Set default based on type
          setValue(event.type === 'boolean' ? 'false' : '');
        }
      } catch (error) {
        console.error('Failed to load event value:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadValue();
  }, [event.id, dateStr]);

  // Auto-save value changes
  const saveValue = React.useCallback(
    async (newValue: string) => {
      try {
        await setEventValue(event.id, dateStr, newValue);
      } catch (error) {
        console.error('Failed to save event value:', error);
      }
    },
    [event.id, dateStr]
  );

  const handleBooleanChange = async (checked: boolean) => {
    const newValue = checked.toString();
    setValue(newValue);
    await saveValue(newValue);
  };

  const handleNumberChange = async (newValue: string) => {
    // Allow whole numbers and decimals (e.g. 1.5 hours), but nothing else.
    if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
      setValue(newValue);
      await saveValue(newValue);
    }
  };

  // Shared step logic for + / -, reading the latest value from the ref so it
  // works correctly when the button is held down and repeats.
  const stepNumber = React.useCallback(
    (delta: number) => {
      const current = valueRef.current === '' ? 0 : Number(valueRef.current) || 0;
      const next = Math.max(0, current + delta).toString();
      valueRef.current = next;
      setValue(next);
      saveValue(next);
    },
    [saveValue]
  );

  // Begin repeating a step after the button is held briefly.
  const startHold = React.useCallback(
    (delta: number) => {
      stopHold();
      stepNumber(delta); // one immediate step on long-press
      holdTimer.current = setInterval(() => stepNumber(delta), 100);
    },
    [stepNumber, stopHold]
  );

  const handleNumberIncrement = () => stepNumber(1);
  const handleNumberDecrement = () => stepNumber(-1);

  const handleTextChange = async (newValue: string) => {
    setValue(newValue);
    await saveValue(newValue);
  };

  if (isLoading) {
    return (
      <View
        className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-4"
        style={{ borderLeftWidth: 4, borderLeftColor: event.color }}
      >
        <Text className="text-[#737373] dark:text-[#a3a3a3]">Loading...</Text>
      </View>
    );
  }

  // A number counts as "tracked" as soon as a value is entered — including an
  // intentional 0 (e.g. "0 cigarettes today" is real, meaningful data).
  const hasValue = event.type === 'boolean'
    ? value === 'true'
    : event.type === 'number'
    ? value.trim() !== '' && !isNaN(parseFloat(value))
    : value.trim() !== '';

  return (
    <View className="bg-white dark:bg-[#0a0a0a] border border-[#e5e5e5] dark:border-[#262626] rounded-lg p-3 flex-row items-center" style={{ borderLeftWidth: 4, borderLeftColor: event.color }}>
      {/* Event Name */}
      <View className="flex-1 mr-3">
        <Text className="font-semibold text-base text-[#0a0a0a] dark:text-[#fafafa]">{event.name}</Text>
        {event.unit && (
          <Text className="text-xs text-[#737373] dark:text-[#a3a3a3]">{event.unit}</Text>
        )}
      </View>

      {/* Input Widget */}
      <View className="flex-row items-center gap-2">
        {/* Boolean Widget */}
        {event.type === 'boolean' && (
          <Switch
            checked={value === 'true'}
            onCheckedChange={handleBooleanChange}
          />
        )}

        {/* Number Widget */}
        {event.type === 'number' && (
          <>
            <Button
              size="icon"
              variant="outline"
              onPress={handleNumberDecrement}
              onLongPress={() => startHold(-1)}
              onPressOut={stopHold}
              disabled={value === '' || Number(value) <= 0}
              className="h-10 w-10"
              accessibilityLabel={`Decrease ${event.name}`}
            >
              <Icon as={MinusIcon} className="size-4" />
            </Button>
            <Input
              value={value}
              onChangeText={handleNumberChange}
              keyboardType="decimal-pad"
              placeholder="0"
              className="text-center native:h-10 w-20 text-base font-semibold"
              accessibilityLabel={`${event.name} value`}
            />
            <Button
              size="icon"
              variant="outline"
              onPress={handleNumberIncrement}
              onLongPress={() => startHold(1)}
              onPressOut={stopHold}
              className="h-10 w-10"
              accessibilityLabel={`Increase ${event.name}`}
            >
              <Icon as={PlusIcon} className="size-4" />
            </Button>
          </>
        )}

        {/* String Widget */}
        {event.type === 'string' && (
          <Input
            value={value}
            onChangeText={handleTextChange}
            placeholder="Enter text..."
            className="native:h-10 w-40 text-sm"
          />
        )}

        {/* Settings Button */}
        <Button
          size="icon"
          variant="ghost"
          onPress={() => router.push({ pathname: '/edit-event' as any, params: { id: event.id.toString() } })}
          className="h-10 w-10"
          accessibilityLabel={`Edit ${event.name}`}
        >
          <Icon as={Settings2Icon} className="size-4 text-[#737373] dark:text-[#a3a3a3]" />
        </Button>
      </View>
    </View>
  );
}
