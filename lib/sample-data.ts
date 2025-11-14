import { webDb } from '@/db/client.web';
import { format, subDays } from 'date-fns';

export async function addSampleData() {
  console.log('Adding sample data...');

  // Create sample events with more variety
  const sampleEvents = [
    {
      name: 'Sleep Hours',
      type: 'number' as const,
      unit: 'hours',
      color: '#3b82f6',
      order: 0,
    },
    {
      name: 'Exercise',
      type: 'boolean' as const,
      color: '#10b981',
      order: 1,
    },
    {
      name: 'Productivity',
      type: 'number' as const,
      unit: 'hours',
      color: '#f59e0b',
      order: 2,
    },
    {
      name: 'Mood',
      type: 'number' as const,
      unit: '/10',
      color: '#ec4899',
      order: 3,
    },
    {
      name: 'Water Intake',
      type: 'number' as const,
      unit: 'glasses',
      color: '#06b6d4',
      order: 4,
    },
    {
      name: 'Meditation',
      type: 'boolean' as const,
      color: '#8b5cf6',
      order: 5,
    },
    {
      name: 'Screen Time',
      type: 'number' as const,
      unit: 'hours',
      color: '#ef4444',
      order: 6,
    },
    {
      name: 'Social Time',
      type: 'number' as const,
      unit: 'hours',
      color: '#f97316',
      order: 7,
    },
    {
      name: 'Caffeine',
      type: 'number' as const,
      unit: 'cups',
      color: '#84cc16',
      order: 8,
    },
    {
      name: 'Reading',
      type: 'boolean' as const,
      color: '#14b8a6',
      order: 9,
    },
  ];

  // Insert events using webDb methods
  const insertedEvents = [];
  for (const eventData of sampleEvents) {
    const event = await webDb.createEvent(eventData);
    insertedEvents.push(event);
  }

  console.log(`Created ${insertedEvents.length} events`);

  // Generate sample data for the last 2 years (730 days)
  const today = new Date();
  let dataPointCount = 0;

  for (let i = 0; i < 730; i++) {
    const date = format(subDays(today, i), 'yyyy-MM-dd');

    // Add some seasonal variation
    const seasonalFactor = Math.sin((i / 365) * Math.PI * 2) * 0.5 + 0.5; // 0-1 range

    // Sleep hours (6-9 hours, with seasonal variation)
    const sleepHours = 6.5 + Math.random() * 2.5 + seasonalFactor * 0.5;

    // Exercise (60% chance if sleep > 7 hours, less in winter)
    const exerciseChance = sleepHours > 7 ? 0.6 : 0.4;
    const exercise = Math.random() < (exerciseChance * (0.8 + seasonalFactor * 0.4));

    // Productivity (correlated with sleep and exercise)
    const baseProductivity = sleepHours - 2;
    const exerciseBonus = exercise ? 1 : 0;
    const productivity = Math.max(
      2,
      Math.min(10, baseProductivity + exerciseBonus + (Math.random() - 0.5) * 2)
    );

    // Mood (correlated with sleep, exercise, and season)
    const baseMood = sleepHours - 1;
    const exerciseMoodBonus = exercise ? 1.5 : 0;
    const seasonalMoodBonus = seasonalFactor * 1.5;
    const mood = Math.max(
      3,
      Math.min(10, baseMood + exerciseMoodBonus + seasonalMoodBonus + (Math.random() - 0.5) * 1.5)
    );

    // Water Intake (6-12 glasses, correlated with exercise)
    const waterIntake = exercise
      ? 8 + Math.random() * 4
      : 6 + Math.random() * 3;

    // Meditation (30% base, higher when stressed/poor sleep)
    const meditationChance = sleepHours < 7 ? 0.5 : 0.3;
    const meditation = Math.random() < meditationChance;

    // Screen Time (2-8 hours, inversely correlated with productivity and exercise)
    const screenTime = Math.max(
      2,
      Math.min(8, 8 - productivity * 0.4 - (exercise ? 1 : 0) + (Math.random() - 0.5) * 2)
    );

    // Social Time (0-6 hours, weekend pattern and seasonal)
    const isWeekend = i % 7 < 2; // Roughly weekend pattern
    const socialTime = isWeekend
      ? 2 + Math.random() * 4 + seasonalFactor * 1
      : Math.random() * 2 + seasonalFactor * 0.5;

    // Caffeine (1-5 cups, inversely correlated with sleep)
    const caffeine = Math.max(
      1,
      Math.min(5, 5 - sleepHours * 0.5 + (Math.random() - 0.5) * 1.5)
    );

    // Reading (40% chance, higher when less screen time)
    const readingChance = screenTime < 4 ? 0.6 : 0.3;
    const reading = Math.random() < readingChance;

    // Insert values using webDb
    await webDb.setEventValue(insertedEvents[0].id, date, sleepHours.toFixed(1));
    await webDb.setEventValue(insertedEvents[1].id, date, exercise.toString());
    await webDb.setEventValue(insertedEvents[2].id, date, productivity.toFixed(1));
    await webDb.setEventValue(insertedEvents[3].id, date, mood.toFixed(1));
    await webDb.setEventValue(insertedEvents[4].id, date, waterIntake.toFixed(1));
    await webDb.setEventValue(insertedEvents[5].id, date, meditation.toString());
    await webDb.setEventValue(insertedEvents[6].id, date, screenTime.toFixed(1));
    await webDb.setEventValue(insertedEvents[7].id, date, socialTime.toFixed(1));
    await webDb.setEventValue(insertedEvents[8].id, date, caffeine.toFixed(1));
    await webDb.setEventValue(insertedEvents[9].id, date, reading.toString());

    dataPointCount += 10;
  }

  console.log(`Added ${dataPointCount} data points`);
  console.log('Sample data added successfully!');

  return {
    eventsCreated: insertedEvents.length,
    dataPointsAdded: dataPointCount,
  };
}
