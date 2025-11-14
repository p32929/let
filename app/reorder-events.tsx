import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { GripVerticalIcon } from 'lucide-react-native';
import { reorderEvents } from '@/db/operations/events';
import { useEventsStore } from '@/lib/stores/events-store';
import type { Event } from '@/types/events';

export default function ReorderEventsScreen() {
  const { events: storeEvents, refreshEvents } = useEventsStore();
  const [events, setEvents] = React.useState<Event[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setEvents([...storeEvents].sort((a, b) => a.order - b.order));
  }, [storeEvents]);

  const moveEventUp = (index: number) => {
    if (index === 0) return;
    const newEvents = [...events];
    [newEvents[index - 1], newEvents[index]] = [newEvents[index], newEvents[index - 1]];
    setEvents(newEvents);
  };

  const moveEventDown = (index: number) => {
    if (index === events.length - 1) return;
    const newEvents = [...events];
    [newEvents[index], newEvents[index + 1]] = [newEvents[index + 1], newEvents[index]];
    setEvents(newEvents);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const eventIds = events.map((e) => e.id);
      await reorderEvents(eventIds);
      await refreshEvents();
      router.back();
    } catch (error) {
      console.error('Failed to reorder events:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Reorder Events',
          presentation: 'modal',
        }}
      />
      <View className="flex-1 bg-background">
        <ScrollView className="flex-1 p-4">
          <Text className="text-muted-foreground mb-4">
            Use the arrow buttons to change the order of your events
          </Text>
          <View className="gap-2">
            {events.map((event, index) => (
              <View
                key={event.id}
                className="bg-card border border-border rounded-lg p-4 flex-row items-center gap-3"
                style={{ borderLeftWidth: 4, borderLeftColor: event.color }}
              >
                <Icon as={GripVerticalIcon} className="size-5 text-muted-foreground" />
                <View className="flex-1">
                  <Text className="font-semibold">{event.name}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {event.type === 'boolean'
                      ? 'Yes/No'
                      : event.type === 'number'
                        ? `Number${event.unit ? ` (${event.unit})` : ''}`
                        : 'Text'}
                  </Text>
                </View>
                <View className="flex-row gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => moveEventUp(index)}
                    disabled={index === 0 || isSubmitting}
                  >
                    <Text>↑</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => moveEventDown(index)}
                    disabled={index === events.length - 1 || isSubmitting}
                  >
                    <Text>↓</Text>
                  </Button>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Footer Buttons */}
        <View className="border-t border-border p-4 gap-3">
          <View className="flex-row gap-3">
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
              disabled={isSubmitting}
              className="flex-1"
            >
              <Text>{isSubmitting ? 'Saving...' : 'Save Order'}</Text>
            </Button>
          </View>
        </View>
      </View>
    </>
  );
}
