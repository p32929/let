import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { logError } from '@/lib/error-tracker';
import { router } from 'expo-router';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component to catch React component errors
 *
 * Automatically logs errors to the crash reporting system
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to our error tracking system
    logError(error, {
      action: 'React Component Error',
      component: 'ErrorBoundary',
      additionalInfo: {
        componentStack: errorInfo.componentStack,
      },
    }).catch((loggingError) => {
      console.error('Failed to log error:', loggingError);
    });

    // Also log to console for development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleViewReports = () => {
    router.push('/crash-reports' as any);
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <View className="flex-1 bg-background items-center justify-center p-6">
          <View className="bg-card rounded-lg border border-border p-6 max-w-md w-full">
            <Text className="text-2xl font-bold text-destructive mb-4 text-center">
              Oops! Something went wrong
            </Text>

            <Text className="text-base text-foreground mb-4 text-center">
              The app encountered an unexpected error. Don't worry, the error has been logged and you can view the details in crash reports.
            </Text>

            {this.state.error && (
              <View className="bg-secondary/50 rounded-lg p-4 mb-4">
                <Text className="text-sm font-semibold mb-2">Error Details:</Text>
                <ScrollView
                  className="max-h-40"
                  nestedScrollEnabled
                >
                  <Text className="text-xs font-mono text-muted-foreground">
                    {this.state.error.message}
                  </Text>
                  {this.state.error.stack && (
                    <Text className="text-xs font-mono text-muted-foreground mt-2">
                      {this.state.error.stack}
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}

            <View className="gap-3">
              <Pressable
                className="bg-primary rounded-lg px-6 py-3 items-center"
                onPress={this.handleReset}
              >
                <Text className="text-primary-foreground font-semibold">
                  Try Again
                </Text>
              </Pressable>

              <Pressable
                className="bg-secondary rounded-lg px-6 py-3 items-center"
                onPress={this.handleViewReports}
              >
                <Text className="text-secondary-foreground font-semibold">
                  View Crash Reports
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
