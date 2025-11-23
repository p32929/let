import { createEvent, setEventValue } from '@/db/operations/events';
import { format, subDays } from 'date-fns';

export async function addSampleData(onProgress?: (progress: number, message: string) => void) {
  console.log('Adding sample data...');

  if (onProgress) onProgress(0, 'Creating events...');

  // Create comprehensive sample events
  const sampleEvents = [
    {
      name: 'Sleep',
      type: 'number' as const,
      unit: 'hours',
      color: '#3b82f6', // blue
    },
    {
      name: 'Good day',
      type: 'boolean' as const,
      color: '#22c55e', // green
    },
    {
      name: 'Went outside',
      type: 'boolean' as const,
      color: '#84cc16', // lime
    },
    {
      name: 'Ran',
      type: 'number' as const,
      unit: 'minutes',
      color: '#f97316', // orange
    },
    {
      name: 'Drank coffee',
      type: 'boolean' as const,
      color: '#78350f', // brown
    },
    {
      name: 'Drank tea',
      type: 'boolean' as const,
      color: '#14b8a6', // teal
    },
    {
      name: 'Romance',
      type: 'number' as const,
      unit: 'hours',
      color: '#ec4899', // pink
    },
    {
      name: 'Watched movie',
      type: 'boolean' as const,
      color: '#8b5cf6', // purple
    },
    {
      name: 'Watched Korean drama',
      type: 'boolean' as const,
      color: '#a855f7', // violet
    },
    {
      name: 'Dress color',
      type: 'string' as const,
      color: '#ef4444', // red
    },
    {
      name: 'Woke up at',
      type: 'string' as const,
      color: '#f59e0b', // amber
    },
    {
      name: 'Workout',
      type: 'number' as const,
      unit: 'minutes',
      color: '#10b981', // emerald
    },
  ];

  // Insert events using database operations
  const insertedEvents = [];
  for (let i = 0; i < sampleEvents.length; i++) {
    const eventData = sampleEvents[i];
    const event = await createEvent(eventData);
    insertedEvents.push(event);

    // Update progress for each event created
    const eventProgress = Math.floor(((i + 1) / sampleEvents.length) * 10);
    if (onProgress) {
      onProgress(eventProgress, `Creating events: ${i + 1}/${sampleEvents.length}`);
    }
  }

  console.log(`Created ${insertedEvents.length} events`);
  if (onProgress) onProgress(10, `Created ${insertedEvents.length} events`);

  // Small delay before starting data generation
  await new Promise(resolve => setTimeout(resolve, 100));

  // Generate sample data for the last 2 years (730 days)
  const today = new Date();
  let dataPointCount = 0;
  const totalDays = 730;
  const batchSize = 10; // Process 10 days at a time to prevent database locks

  // Dress colors and wake up times
  const dressColors = ['red', 'blue', 'black', 'white', 'green', 'pink', 'purple', 'yellow'];
  const wakeUpTimes = ['6am', '7am', '8am', '9am', '10am'];

  // Batch all value insertions
  const valuesToInsert: Array<{ eventId: number; date: string; value: string }> = [];

  for (let i = 0; i < totalDays; i++) {
    const date = format(subDays(today, i), 'yyyy-MM-dd');

    // Add some patterns and correlations
    const isWeekend = i % 7 < 2; // Roughly weekend pattern
    const seasonalFactor = Math.sin((i / 365) * Math.PI * 2) * 0.5 + 0.5; // 0-1 range

    // Dress color (with patterns - red tends to be on good days)
    const dressColorIndex = Math.floor(Math.random() * dressColors.length);
    const dressColor = dressColors[dressColorIndex];
    const isRedDress = dressColor === 'red';
    const isBlackDress = dressColor === 'black';

    // Wake up time (earlier wake up = better day pattern)
    const wakeUpIndex = Math.floor(Math.random() * wakeUpTimes.length);
    const wakeUpTime = wakeUpTimes[wakeUpIndex];
    const wokeUpEarly = wakeUpIndex < 2; // 6am or 7am

    // Sleep (6-10 hours, better on weekends, better when waking up early)
    const baseSleep = wokeUpEarly ? 8 : 7;
    const weekendBonus = isWeekend ? 1 : 0;
    const sleep = Math.round(baseSleep + weekendBonus + (Math.random() - 0.5) * 2);

    // Good day (influenced by sleep, dress color, wake up time)
    const sleepBoost = sleep > 7.5 ? 0.3 : 0;
    const redDressBoost = isRedDress ? 0.4 : 0;
    const earlyWakeBoost = wokeUpEarly ? 0.2 : 0;
    const blackDressPenalty = isBlackDress ? -0.3 : 0;
    const goodDayChance = 0.4 + sleepBoost + redDressBoost + earlyWakeBoost + blackDressPenalty;
    const goodDay = Math.random() < Math.max(0.1, Math.min(0.95, goodDayChance));

    // Went outside (more likely on good days and weekends)
    const wentOutsideChance = goodDay ? 0.8 : 0.5;
    const weekendOutsideBoost = isWeekend ? 0.2 : 0;
    const wentOutside = Math.random() < (wentOutsideChance + weekendOutsideBoost + seasonalFactor * 0.2);

    // Ran (only when went outside, more when wearing red/comfortable colors)
    const ranChance = wentOutside ? (isRedDress ? 0.5 : 0.3) : 0.05;
    const ran = Math.random() < ranChance ? Math.round(20 + Math.random() * 40) : 0; // 0 or 20-60 minutes

    // Coffee vs Tea (mutually somewhat exclusive, coffee on tired days)
    const drankCoffee = sleep < 7 ? Math.random() < 0.8 : Math.random() < 0.5;
    const drankTea = !drankCoffee && Math.random() < 0.6;

    // Romance (more on good days, weekends, after good sleep)
    const romanceChance = goodDay && isWeekend ? 0.6 : goodDay ? 0.3 : 0.1;
    const romance = Math.random() < romanceChance ? Math.round(1 + Math.random() * 3) : 0; // 0 or 1-4 hours

    // Watched movie (more on weekends, less on good productive days)
    const movieChance = isWeekend ? 0.5 : goodDay ? 0.2 : 0.4;
    const watchedMovie = Math.random() < movieChance;

    // Watched Korean drama (alternative to movie, more addictive pattern)
    const dramaChance = !watchedMovie ? 0.4 : 0.1;
    const watchedKoreanDrama = Math.random() < dramaChance;

    // Workout (different from running, more structured)
    const workoutChance = wokeUpEarly ? 0.6 : goodDay ? 0.4 : 0.2;
    const workout = Math.random() < workoutChance ? Math.round(30 + Math.random() * 60) : 0; // 0 or 30-90 minutes

    // Add values to batch array
    valuesToInsert.push(
      { eventId: insertedEvents[0].id, date, value: sleep.toFixed(0) },
      { eventId: insertedEvents[1].id, date, value: goodDay.toString() },
      { eventId: insertedEvents[2].id, date, value: wentOutside.toString() },
      { eventId: insertedEvents[3].id, date, value: ran.toFixed(0) },
      { eventId: insertedEvents[4].id, date, value: drankCoffee.toString() },
      { eventId: insertedEvents[5].id, date, value: drankTea.toString() },
      { eventId: insertedEvents[6].id, date, value: romance.toFixed(0) },
      { eventId: insertedEvents[7].id, date, value: watchedMovie.toString() },
      { eventId: insertedEvents[8].id, date, value: watchedKoreanDrama.toString() },
      { eventId: insertedEvents[9].id, date, value: dressColor },
      { eventId: insertedEvents[10].id, date, value: wakeUpTime },
      { eventId: insertedEvents[11].id, date, value: workout.toFixed(0) }
    );

    dataPointCount += 12;

    // Insert batch when we reach batchSize days or at the end
    if ((i + 1) % batchSize === 0 || i === totalDays - 1) {
      for (const item of valuesToInsert) {
        await setEventValue(item.eventId, item.date, item.value);
      }

      const progress = 10 + Math.floor(((i + 1) / totalDays) * 90);
      if (onProgress) {
        onProgress(progress, `Loading data: ${i + 1}/${totalDays} days`);
      }

      // Small delay to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 10));

      // Clear batch array
      valuesToInsert.length = 0;
    }
  }

  console.log(`Added ${dataPointCount} data points`);
  console.log('Sample data added successfully!');

  if (onProgress) onProgress(100, 'Sample data loaded successfully!');

  return {
    eventsCreated: insertedEvents.length,
    dataPointsAdded: dataPointCount,
  };
}
