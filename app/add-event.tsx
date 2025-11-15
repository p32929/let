import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Stack, router } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { createEvent } from '@/db/operations/events';
import { useEventsStore } from '@/lib/stores/events-store';
import type { EventType } from '@/types/events';
import { CheckIcon, HashIcon, TypeIcon } from 'lucide-react-native';

const EVENT_TYPES: { value: EventType; label: string; icon: any; description: string }[] = [
  { value: 'boolean', label: 'Yes/No', icon: CheckIcon, description: 'Track completion or presence' },
  { value: 'number', label: 'Number', icon: HashIcon, description: 'Track quantities or measurements' },
  { value: 'string', label: 'Text', icon: TypeIcon, description: 'Track notes or descriptions' },
];

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#a855f7', // violet
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
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
          title: 'Add New Event',
          presentation: 'modal',
        }}
      />
      <ScrollView className="flex-1 bg-background">
        <View className="p-6 gap-6">
          {/* Header */}
          <View className="gap-1">
            <Text className="text-2xl font-bold text-foreground">Create Event</Text>
            <Text className="text-sm text-muted-foreground">
              Define a new event to track in your daily life
            </Text>
          </View>

          {/* Event Name */}
          <View className="gap-2">
            <Label className="text-base font-semibold">Event Name</Label>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="e.g., Morning Exercise, Water Intake"
              className="native:h-12 text-base"
            />
          </View>

          {/* Event Type */}
          <View className="gap-2">
            <Label className="text-base font-semibold">Type</Label>
            <View className="gap-2">
              {EVENT_TYPES.map((eventType) => (
                <Pressable
                  key={eventType.value}
                  onPress={() => setType(eventType.value)}
                  className={`flex-row items-center rounded-lg border-2 p-3 ${
                    type === eventType.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <View className={`size-10 rounded-lg items-center justify-center mr-3 ${
                    type === eventType.value ? 'bg-primary' : 'bg-muted'
                  }`}>
                    <Icon
                      as={eventType.icon}
                      className={`size-5 ${type === eventType.value ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-semibold ${
                      type === eventType.value ? 'text-primary' : 'text-foreground'
                    }`}>
                      {eventType.label}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {eventType.description}
                    </Text>
                  </View>
                  {type === eventType.value && (
                    <View className="size-5 rounded-full bg-primary items-center justify-center">
                      <Icon as={CheckIcon} className="size-3 text-primary-foreground" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Unit (optional) */}
          {type === 'number' && (
            <View className="gap-2">
              <Label className="text-base font-semibold">
                Unit <Text className="text-muted-foreground font-normal">(optional)</Text>
              </Label>
              <Input
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g., minutes, cups, km, hours"
                className="native:h-12 text-base"
              />
              <Text className="text-xs text-muted-foreground">
                Add a unit to help you understand your measurements better
              </Text>
            </View>
          )}

          {/* Color Picker */}
          <View className="gap-2">
            <Label className="text-base font-semibold">Color Theme</Label>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row"
              contentContainerStyle={{ gap: 8 }}
            >
              {/* Preset Colors */}
              {PRESET_COLORS.map((presetColor) => (
                <Pressable
                  key={presetColor}
                  onPress={() => setColor(presetColor)}
                >
                  <View
                    className={`size-12 rounded-lg items-center justify-center ${
                      color === presetColor ? 'border-2 border-primary' : 'border border-border'
                    }`}
                    style={{ backgroundColor: presetColor }}
                  >
                    {color === presetColor && (
                      <Icon as={CheckIcon} className="size-5 text-white" />
                    )}
                  </View>
                </Pressable>
              ))}

              {/* Custom Color Picker */}
              <Pressable
                onPress={() => {
                  // @ts-ignore - web only
                  if (typeof document !== 'undefined') {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = color;
                    input.onchange = (e: any) => setColor(e.target.value);
                    input.click();
                  }
                }}
                className="size-12 rounded-lg border-2 border-dashed border-border bg-muted items-center justify-center"
              >
                <View
                  className="size-8 rounded-md border border-border"
                  style={{ backgroundColor: color }}
                />
              </Pressable>
            </ScrollView>
          </View>

          {/* Buttons */}
          <View className="flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onPress={() => router.back()}
              disabled={isSubmitting}
              className="flex-1 h-12"
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              onPress={handleSubmit}
              disabled={!name.trim() || isSubmitting}
              className="flex-1 h-12"
            >
              <Text>{isSubmitting ? 'Creating...' : 'Create Event'}</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
