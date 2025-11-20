import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import * as React from 'react';
import { View, Pressable } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { GripVerticalIcon } from 'lucide-react-native';
import { reorderEvents } from '@/db/operations/events';
import { useEventsStore } from '@/lib/stores/events-store';
import type { Event } from '@/types/events';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const SCREEN_OPTIONS = {
  title: 'Reorder Events',
  presentation: 'modal' as const,
};

export default function ReorderEventsScreen() {
  const { events: storeEvents, refreshEvents } = useEventsStore();
  const [events, setEvents] = React.useState<Event[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const insets = useSafeAreaInsets();

  // Redirect if no events
  React.useEffect(() => {
    if (storeEvents.length === 0) {
      router.replace('/');
    }
  }, [storeEvents.length]);

  React.useEffect(() => {
    setEvents([...storeEvents].sort((a, b) => a.order - b.order));
  }, [storeEvents]);

  const renderItem = ({ item: event, drag, isActive }: RenderItemParams<Event>) => (
    <ScaleDecorator>
      <View
        className={`bg-card border border-border rounded-lg p-4 flex-row items-center gap-3 mb-2 ${
          isActive ? 'opacity-70' : ''
        }`}
        style={{ borderLeftWidth: 4, borderLeftColor: event.color }}
      >
        <Pressable onLongPress={drag} disabled={isActive}>
          <Icon as={GripVerticalIcon} className="size-5 text-muted-foreground" />
        </Pressable>
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
      </View>
    </ScaleDecorator>
  );

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
      <Stack.Screen options={SCREEN_OPTIONS} />
      <GestureHandlerRootView className="flex-1 bg-background">
        <View className="flex-1">
          <View className="p-4 pb-2">
            <Text className="text-muted-foreground">
              Press and hold the grip icon to drag and reorder your events
            </Text>
          </View>

          <DraggableFlatList
            data={events}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            onDragEnd={({ data }) => setEvents(data)}
            containerStyle={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
          />

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
              <Button onPress={handleSubmit} disabled={isSubmitting} className="flex-1">
                <Text>{isSubmitting ? 'Saving...' : 'Save Order'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </>
  );
}