import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { createEvent } from '@/db/operations/events';
import { useEventsStore } from '@/lib/stores/events-store';
import type { EventType } from '@/types/events';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'boolean', label: 'Yes/No' },
  { value: 'number', label: 'Number' },
  { value: 'string', label: 'Text' },
];

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export default function AddEventScreen() {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<EventType>('boolean');
  const [unit, setUnit] = React.useState('');
  const [color, setColor] = React.useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const refreshEvents = useEventsStore((state) => state.refreshEvents);

  const handleSubmit = async () => {
    if (!name.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createEvent({
        name: name.trim(),
        type,
        unit: unit.trim() || undefined,
        color,
      });

      await refreshEvents();
      router.back();
    } catch (error) {
      console.error('Failed to create event:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Event',
          presentation: 'modal',
        }}
      />
      <ScrollView className="flex-1 bg-background">
        <View className="p-4 gap-6">
          {/* Event Name */}
          <View className="gap-2">
            <Label>Event Name</Label>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="e.g., Morning Exercise"
              className="native:h-12"
            />
          </View>

          {/* Event Type */}
          <View className="gap-2">
            <Label>Type</Label>
            <View className="flex-row gap-2">
              {EVENT_TYPES.map((eventType) => (
                <Pressable
                  key={eventType.value}
                  onPress={() => setType(eventType.value)}
                  className={`flex-1 items-center justify-center rounded-lg border-2 p-3 ${
                    type === eventType.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      type === eventType.value ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {eventType.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Unit (optional) */}
          {type === 'number' && (
            <View className="gap-2">
              <Label>
                Unit <Text className="text-muted-foreground">(optional)</Text>
              </Label>
              <Input
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g., minutes, cups, km"
                className="native:h-12"
              />
            </View>
          )}

          {/* Color Picker */}
          <View className="gap-2">
            <Label>Color</Label>
            <View className="flex-row flex-wrap gap-3">
              {PRESET_COLORS.map((presetColor) => (
                <Pressable
                  key={presetColor}
                  onPress={() => setColor(presetColor)}
                  className={`size-12 rounded-full items-center justify-center ${
                    color === presetColor ? 'border-4 border-primary' : ''
                  }`}
                  style={{ backgroundColor: presetColor }}
                >
                  {color === presetColor && (
                    <View className="size-2 rounded-full bg-white" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Buttons */}
          <View className="flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onPress={() => router.back()}
              disabled={isSubmitting}
              className="flex-1"
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              onPress={handleSubmit}
              disabled={!name.trim() || isSubmitting}
              className="flex-1"
            >
              <Text>{isSubmitting ? 'Creating...' : 'Create Event'}</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
