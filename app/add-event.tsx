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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EVENT_TYPES: { value: EventType; label: string; icon: any; description: string }[] = [
  { value: 'boolean', label: 'Yes/No', icon: CheckIcon, description: 'Track completion or presence' },
  { value: 'number', label: 'Number', icon: HashIcon, description: 'Track quantities or measurements' },
  { value: 'string', label: 'Text', icon: TypeIcon, description: 'Track notes or descriptions' },
];

const PRESET_COLORS = [
  // Reds
  '#ef4444', '#dc2626', '#b91c1c', '#991b1b',
  // Oranges
  '#f97316', '#ea580c', '#c2410c', '#9a3412',
  // Yellows/Amber
  '#f59e0b', '#eab308', '#ca8a04', '#a16207',
  // Limes/Greens
  '#84cc16', '#65a30d', '#22c55e', '#16a34a',
  // Emeralds/Teals
  '#10b981', '#059669', '#14b8a6', '#0d9488',
  // Cyans/Skys
  '#06b6d4', '#0891b2', '#0ea5e9', '#0284c7',
  // Blues
  '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af',
  // Indigos/Purples
  '#6366f1', '#4f46e5', '#8b5cf6', '#7c3aed',
  // Violets/Fuchsias
  '#a855f7', '#9333ea', '#d946ef', '#c026d3',
  // Pinks/Roses
  '#ec4899', '#db2777', '#f43f5e', '#e11d48',
  // Neutrals
  '#71717a', '#52525b', '#3f3f46', '#27272a',
];

const SCREEN_OPTIONS = {
  title: 'Add New Event',
  presentation: 'modal' as const,
};

export default function AddEventScreen() {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<EventType>('boolean');
  const [unit, setUnit] = React.useState('');
  const [color, setColor] = React.useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { events, refreshEvents } = useEventsStore();
  const insets = useSafeAreaInsets();

  // Redirect to index if no events
  React.useEffect(() => {
    if (events.length === 0) {
      router.replace('/');
    }
  }, [events.length]);

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
      <Stack.Screen options={SCREEN_OPTIONS} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
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
                  className={`flex-row items-center rounded-lg p-4 ${
                    type === eventType.value
                      ? 'bg-card border-[3px] border-[#171717] dark:border-[#fafafa]'
                      : 'bg-card border-2 border-border'
                  }`}
                >
                  <View className={`size-12 rounded-lg items-center justify-center mr-3 ${
                    type === eventType.value ? 'bg-[#171717] dark:bg-[#fafafa]' : 'bg-muted'
                  }`}>
                    <Icon
                      as={eventType.icon}
                      className={`size-6 ${type === eventType.value ? 'text-[#fafafa] dark:text-[#171717]' : 'text-muted-foreground'}`}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-bold text-base ${
                      type === eventType.value ? 'text-[#171717] dark:text-[#fafafa]' : 'text-foreground'
                    }`}>
                      {eventType.label}
                    </Text>
                    <Text className={`text-xs text-muted-foreground`}>
                      {eventType.description}
                    </Text>
                  </View>
                  {type === eventType.value && (
                    <View className="size-6 rounded-full bg-[#171717] dark:bg-[#fafafa] items-center justify-center">
                      <Icon as={CheckIcon} className="size-4 text-[#fafafa] dark:text-[#171717]" />
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
