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
    setValue(newValue);
    // Only save if it's a valid number or empty
    if (newValue === '' || !isNaN(Number(newValue))) {
      await saveValue(newValue);
    }
  };

  const handleNumberIncrement = async () => {
    const currentNum = value === '' ? 0 : Number(value);
    const newValue = (currentNum + 1).toString();
    setValue(newValue);
    await saveValue(newValue);
  };

  const handleNumberDecrement = async () => {
    const currentNum = value === '' ? 0 : Number(value);
    const newValue = Math.max(0, currentNum - 1).toString();
    setValue(newValue);
    await saveValue(newValue);
  };

  const handleTextChange = async (newValue: string) => {
    setValue(newValue);
    await saveValue(newValue);
  };

  if (isLoading) {
    return (
      <View
        className="bg-card border border-border rounded-lg p-4"
        style={{ borderLeftWidth: 4, borderLeftColor: event.color }}
      >
        <Text className="text-muted-foreground">Loading...</Text>
      </View>
    );
  }

  return (
    <View
      className="bg-card border border-border rounded-lg p-4"
      style={{ borderLeftWidth: 4, borderLeftColor: event.color }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1">
          <Text className="font-semibold text-base">{event.name}</Text>
          {event.unit && (
            <Text className="text-sm text-muted-foreground mt-0.5">
              Unit: {event.unit}
            </Text>
          )}
        </View>
        <Button
          size="icon"
          variant="ghost"
          onPress={() => router.push({ pathname: '/edit-event' as any, params: { id: event.id.toString() } })}
          className="ml-2"
        >
          <Icon as={Settings2Icon} className="size-4 text-muted-foreground" />
        </Button>
      </View>

      {/* Boolean Widget */}
      {event.type === 'boolean' && (
        <View className="flex-row items-center justify-between">
          <Text className="text-muted-foreground">
            {value === 'true' ? 'Yes' : 'No'}
          </Text>
          <Switch
            checked={value === 'true'}
            onCheckedChange={handleBooleanChange}
            className="ml-auto"
          />
        </View>
      )}

      {/* Number Widget */}
      {event.type === 'number' && (
        <View className="flex-row items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onPress={handleNumberDecrement}
            disabled={value === '' || Number(value) <= 0}
          >
            <Icon as={MinusIcon} className="size-4" />
          </Button>
          <Input
            value={value}
            onChangeText={handleNumberChange}
            keyboardType="numeric"
            placeholder="0"
            className="flex-1 text-center native:h-12"
          />
          <Button
            size="icon"
            variant="outline"
            onPress={handleNumberIncrement}
          >
            <Icon as={PlusIcon} className="size-4" />
          </Button>
        </View>
      )}

      {/* String Widget */}
      {event.type === 'string' && (
        <Input
          value={value}
          onChangeText={handleTextChange}
          placeholder="Enter text..."
          className="native:h-12"
          multiline
        />
      )}
    </View>
  );
}
