import * as React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from './text';
import { Button } from './button';
import { Icon } from './icon';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react-native';

interface CalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose?: () => void;
}

export function Calendar({ selectedDate, onSelectDate, onClose }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date(selectedDate));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleSelectDate = (date: Date) => {
    onSelectDate(date);
    onClose?.();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <View className="bg-card rounded-lg p-4 border border-border">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Button
          size="icon"
          variant="ghost"
          onPress={handlePreviousMonth}
          className="rounded-full"
        >
          <Icon as={ChevronLeftIcon} className="size-5" />
        </Button>
        <Text className="text-lg font-semibold">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <Button
          size="icon"
          variant="ghost"
          onPress={handleNextMonth}
          className="rounded-full"
        >
          <Icon as={ChevronRightIcon} className="size-5" />
        </Button>
      </View>

      {/* Day names */}
      <View className="flex-row mb-2">
        {dayNames.map((day) => (
          <View key={day} className="flex-1 items-center">
            <Text className="text-xs text-muted-foreground font-medium">{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View className="gap-1">
        {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIndex) => (
          <View key={weekIndex} className="flex-row gap-1">
            {days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((date, dayIndex) => {
              if (!date) {
                return <View key={dayIndex} className="flex-1 aspect-square" />;
              }

              const today = isToday(date);
              const selected = isSelected(date);

              return (
                <Pressable
                  key={dayIndex}
                  onPress={() => handleSelectDate(date)}
                  className={`flex-1 aspect-square items-center justify-center rounded-lg ${
                    selected
                      ? 'bg-primary'
                      : today
                        ? 'bg-muted'
                        : ''
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selected
                        ? 'text-primary-foreground font-bold'
                        : today
                          ? 'text-foreground font-semibold'
                          : 'text-foreground'
                    }`}
                  >
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Quick actions */}
      <View className="flex-row gap-2 mt-4">
        <Button
          variant="outline"
          onPress={() => handleSelectDate(new Date())}
          className="flex-1"
        >
          <Text>Today</Text>
        </Button>
        {onClose && (
          <Button
            variant="outline"
            onPress={onClose}
            className="flex-1"
          >
            <Text>Cancel</Text>
          </Button>
        )}
      </View>
    </View>
  );
}
