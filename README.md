# Life Events Tracker

A React Native app built with Expo for tracking daily life events and habits with beautiful UI components from React Native Reusables.

## ✅ Completed Features (MVP Core)

### Phase 1: Project Setup & Architecture
- ✅ Installed and configured React Native Reusables (32 UI components)
- ✅ Set up database (SQLite with Drizzle ORM)
- ✅ Created data models and schemas (Event, EventValue)
- ✅ Set up navigation structure (Expo Router)
- ✅ Configured TypeScript types for events and tracking data
- ✅ Set up state management (Zustand)

### Phase 2: Core Data Layer
- ✅ Created Event model (name, type, unit, color, order)
- ✅ Created EventValue model (eventId, date, value, timestamp)
- ✅ Implemented CRUD operations for Events
- ✅ Implemented daily value tracking operations
- ✅ Added data validation and auto-save
- ✅ Created database migration system with indexes

### Phase 3: Weekly View Interface
- ✅ Designed and implemented week header component
- ✅ Highlighted current day in week view
- ✅ Created day selector/navigator with previous/next week
- ✅ Displayed events list for selected day

### Phase 4: Event Management
- ✅ Created "Add Event" modal/screen
  - ✅ Event name input
  - ✅ Type selector (Boolean/Number/String)
  - ✅ Unit label input (optional, for numbers)
  - ✅ Color picker with 8 preset colors

### Phase 5: Tracking Widgets
- ✅ Boolean toggle widget (Yes/No with Switch)
- ✅ Number input widget with increment/decrement buttons
- ✅ String/text input widget with multiline support
- ✅ Quick entry interface for daily logging
- ✅ Auto-save functionality for all widget types

## 🏗️ Tech Stack

- **Framework**: Expo (React Native)
- **UI Components**: React Native Reusables (shadcn-style components)
- **Database**: SQLite with Drizzle ORM
- **State Management**: Zustand
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Date Utilities**: date-fns
- **TypeScript**: Full type safety

## 📦 Installed UI Components (32 total)

Accordion, Alert, Alert Dialog, Aspect Ratio, Avatar, Badge, Button, Card, Checkbox, Collapsible, Context Menu, Dialog, Dropdown Menu, Hover Card, Icon, Input, Label, Menubar, Popover, Progress, Radio Group, Select, Separator, Skeleton, Switch, Tabs, Text, Textarea, Toggle, Toggle Group, Tooltip, Native Only Animated View

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Expo CLI
- iOS Simulator (for macOS) or Android Emulator

### Installation

```bash
# Install dependencies
npm install

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on Web
npm run web
```

## 📂 Project Structure

```
├── app/                    # Expo Router pages
│   ├── index.tsx          # Main screen (weekly view)
│   ├── add-event.tsx      # Add event modal
│   └── _layout.tsx        # Root layout
├── components/
│   ├── ui/                # React Native Reusables components (32 files)
│   └── event-tracker.tsx  # Event tracking widget
├── db/
│   ├── schemas/           # Drizzle ORM schemas
│   │   └── events.ts      # Event and EventValue models
│   ├── operations/        # Database operations
│   │   └── events.ts      # CRUD operations
│   ├── client.ts          # Database client
│   └── migrate.ts         # Migration logic
├── lib/
│   ├── stores/            # Zustand stores
│   │   └── events-store.ts
│   ├── date-utils.ts      # Date utility functions
│   ├── utils.ts           # General utilities
│   └── theme.ts           # Theme configuration
└── types/                 # TypeScript type definitions
    └── events.ts          # Event and EventValue types
```

## 🎨 Features

### Weekly View
- Navigate between weeks with previous/next buttons
- Select any day of the week to view/track events
- Current day is highlighted
- Week range displayed at the top
- Smooth navigation between days

### Event Tracking
- **Boolean Events**: Simple yes/no toggle (e.g., "Did you exercise?")
- **Number Events**: Numeric input with +/- buttons (e.g., "Glasses of water")
- **String Events**: Text input for notes (e.g., "Mood", "Journal entry")
- Auto-save on every change
- Color-coded event cards with custom colors
- Loading states for better UX

### Event Management
- Create new events with custom name, type, and color
- Optional unit labels for number events (e.g., "cups", "minutes", "km")
- Beautiful color picker with 8 preset colors
- Events maintain order
- Modal presentation for clean UX

## 🎯 Next Priority Features

Based on todo.md, the next features to implement are:

1. **Swipe gestures for week navigation** (Phase 3)
2. **Week-to-week transition animations** (Phase 3)
3. **Edit Event screen/modal** (Phase 4)
4. **Delete Event functionality with confirmation** (Phase 4)
5. **Event reordering/sorting capability** (Phase 4)
6. **Batch entry support** (Phase 5)
7. **Time-stamping for entries** (Phase 5)
8. **Dashboard with charts** (Phase 8)

## 📝 Database Schema

### Events Table
```typescript
{
  id: number (primary key, auto-increment)
  name: string
  type: 'boolean' | 'number' | 'string'
  unit: string | null
  color: string (default: '#3b82f6')
  icon: string | null
  order: number (default: 0)
  created_at: timestamp
  updated_at: timestamp
}
```

### Event Values Table
```typescript
{
  id: number (primary key, auto-increment)
  event_id: number (foreign key → events.id, cascade delete)
  date: string (YYYY-MM-DD format)
  value: string (parsed based on event type)
  timestamp: timestamp
  created_at: timestamp
  updated_at: timestamp
}
```

### Indexes
- `idx_event_values_event_id`: Fast lookup by event
- `idx_event_values_date`: Fast lookup by date
- `idx_event_values_unique`: Unique constraint on (event_id, date)

## 🔧 Available Scripts

```bash
npm run dev      # Start development server with cache clear
npm run android  # Run on Android emulator
npm run ios      # Run on iOS simulator (Mac only)
npm run web      # Run on web browser
npm run clean    # Remove .expo and node_modules
```

## 🎨 Color Palette

Default preset colors for events:
- Blue: `#3b82f6`
- Green: `#10b981`
- Amber: `#f59e0b`
- Red: `#ef4444`
- Purple: `#8b5cf6`
- Pink: `#ec4899`
- Cyan: `#06b6d4`
- Lime: `#84cc16`

## 📱 Supported Platforms

- ✅ iOS (Simulator and Device)
- ✅ Android (Emulator and Device)
- ✅ Web (Desktop browsers)
- ✅ Expo Go (for quick testing)

## 🛠️ Development

### Adding New Events
1. Tap the + button in the header
2. Enter event name
3. Select type (Boolean/Number/String)
4. Choose a color
5. Add unit label (optional, for numbers)
6. Tap "Create Event"

### Tracking Events
1. Select a day from the week view
2. Each event shows with its tracking widget
3. Toggle switches for boolean events
4. Use +/- buttons or type numbers for numeric events
5. Type text for string events
6. Changes are auto-saved

## 📄 License

Private project

## 🙏 Credits

- Built with [Expo](https://expo.dev/)
- UI components from [React Native Reusables](https://reactnativereusables.com/)
- Styled with [NativeWind](https://www.nativewind.dev/)
- Database powered by [Drizzle ORM](https://orm.drizzle.team/)
- State management by [Zustand](https://zustand-demo.pmnd.rs/)
- Date utilities from [date-fns](https://date-fns.org/)

---

**Current Status**: MVP Core is COMPLETE and functional! 🎉

Ready to track your life events and build better habits!
