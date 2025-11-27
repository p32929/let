import { createEvent, setEventValue } from '../db/operations/events';
import { format, subDays } from 'date-fns';

async function addSampleData() {
  console.log('Adding sample data...');

  // Create sample events
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
  ];

  // Insert events
  const insertedEvents = [];
  for (const eventData of sampleEvents) {
    const event = await createEvent(eventData);
    insertedEvents.push(event);
  }

  console.log(`Created ${insertedEvents.length} events`);

  // Generate sample data for the last 30 days
  const today = new Date();
  let dataPointCount = 0;

  for (let i = 0; i < 30; i++) {
    const date = format(subDays(today, i), 'yyyy-MM-dd');

    // Sleep hours (6-9 hours, with some correlation to other metrics)
    const sleepHours = 6 + Math.random() * 3;

    // Exercise (60% chance if sleep > 7 hours)
    const exercise = sleepHours > 7 ? Math.random() > 0.4 : Math.random() > 0.6;

    // Productivity (correlated with sleep and exercise)
    const baseProductivity = sleepHours - 2;
    const exerciseBonus = exercise ? 1 : 0;
    const productivity = Math.max(
      2,
      Math.min(10, baseProductivity + exerciseBonus + (Math.random() - 0.5) * 2)
    );

    // Mood (correlated with sleep and exercise)
    const baseMood = sleepHours - 1;
    const exerciseMoodBonus = exercise ? 1.5 : 0;
    const mood = Math.max(
      3,
      Math.min(10, baseMood + exerciseMoodBonus + (Math.random() - 0.5) * 2)
    );

    // Insert values
    await setEventValue(insertedEvents[0].id, date, sleepHours.toFixed(1));
    await setEventValue(insertedEvents[1].id, date, exercise.toString());
    await setEventValue(insertedEvents[2].id, date, productivity.toFixed(1));
    await setEventValue(insertedEvents[3].id, date, mood.toFixed(1));

    dataPointCount += 4;
  }

  console.log(`Added ${dataPointCount} data points`);
  console.log('Sample data added successfully!');
  console.log(
    'Now refresh your browser to see the dashboard with trends and correlation insights.'
  );
}

addSampleData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error adding sample data:', error);
    process.exit(1);
  });
