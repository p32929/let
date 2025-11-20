# Crash Reporting System

## Overview

The LET app now includes a comprehensive crash reporting system that automatically logs errors and makes them available for debugging. This helps identify and fix issues quickly.

## Features

### 1. **Automatic Error Logging**
- All errors are automatically logged with:
  - Error message and stack trace
  - Timestamp
  - Platform information (iOS/Android/Web)
  - Context about what action caused the error
  - Additional debugging information

### 2. **Crash Report Viewer**
- Access crash reports from the main menu: **Menu → Crash Reports**
- View all errors with detailed information
- Expand reports to see full stack traces
- Copy individual reports for sharing
- Export all reports as JSON
- Delete individual reports or clear all

### 3. **Error Boundary**
- React component errors are caught automatically
- User-friendly error screen is displayed
- Errors are logged for later review
- Option to try again or view crash reports

### 4. **Enhanced Export/Import**
- Export and import errors are logged automatically
- User-friendly error messages
- Direct link to view crash reports when errors occur

## How to Use

### Viewing Crash Reports

1. Open the app menu (three-dot icon)
2. Select **"Crash Reports"**
3. Tap on any report to expand and view details

### Understanding a Crash Report

Each crash report includes:

- **Error Name**: Type of error (e.g., TypeError, ReferenceError)
- **Error Message**: Description of what went wrong
- **Action**: What the user was trying to do
- **Component**: Which part of the app had the error
- **Platform**: iOS, Android, or Web
- **Timestamp**: When the error occurred
- **Stack Trace**: Technical details for debugging

### Sharing Crash Reports

To share a crash report with developers:

1. Open **Crash Reports**
2. Tap the **Share** icon (top right)
3. Choose how to share:
   - Copy to clipboard
   - Share via email/messaging app
   - Save as JSON file

### Clearing Crash Reports

To clear all crash reports:

1. Open **Crash Reports**
2. Tap the **Trash** icon (top right)
3. Confirm deletion

## For Developers

### Manually Logging Errors

You can manually log errors in your code:

```typescript
import { logError } from '@/lib/error-tracker';

try {
  // Your code here
  someFunctionThatMightFail();
} catch (error) {
  await logError(error, {
    action: 'Descriptive action name',
    component: 'ComponentName',
    additionalInfo: {
      userId: user.id,
      // Any other relevant debugging info
    },
  });

  // Handle the error
}
```

### Using the Error Tracking Wrapper

For automatic error tracking with less boilerplate:

```typescript
import { withErrorTracking } from '@/lib/error-tracker';

async function myFunction() {
  return await withErrorTracking(
    'My Function Action',
    async () => {
      // Your code here
      return someResult;
    },
    {
      component: 'MyComponent',
      additionalInfo: { /* debugging info */ },
      rethrow: true, // Set to false if you don't want to rethrow
    }
  );
}
```

### Error Boundary Usage

The app is already wrapped with an ErrorBoundary in `app/_layout.tsx`. To add error boundaries to specific components:

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

function MyComponent() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

## Privacy Note

Crash reports are stored **locally** on your device only. They are not automatically sent to any servers. You have full control over when and how to share crash reports.

## Storage

- Maximum of 50 crash reports are stored
- Older reports are automatically removed when the limit is reached
- Reports are stored in AsyncStorage

## Testing the Crash Reporting

To test that crash reporting works:

1. Temporarily add code that throws an error:
```typescript
throw new Error('Test error for crash reporting');
```

2. Trigger the error by using the feature
3. Check the **Crash Reports** menu to see if the error was logged

## Troubleshooting

### Crash reports not appearing?

- Make sure you're using the latest version of the app
- Check that you have storage permissions enabled
- Try clearing app cache and restarting

### Can't view crash reports?

- Ensure you're navigating to **Menu → Crash Reports**
- If the screen is blank, try refreshing the app

### Export/Import still showing console errors only?

- The errors are now logged AND shown in console
- Check Crash Reports menu for full details

## Future Enhancements

Potential future improvements:

- Integration with Sentry or other crash reporting services
- Automatic crash report submission (with user consent)
- Crash analytics and trends
- Performance monitoring
- User feedback integration

---

**Note**: This crash reporting system is designed to help you debug issues. If you encounter persistent errors, please check the crash reports and contact support with the details.
