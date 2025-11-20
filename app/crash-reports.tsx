import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Stack, router } from 'expo-router';
import {
  ChevronLeftIcon,
  TrashIcon,
  AlertCircleIcon,
  InfoIcon,
  CopyIcon,
  Share2Icon,
} from 'lucide-react-native';
import * as React from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getErrorReports,
  clearErrorReports,
  deleteErrorReport,
  exportErrorReports,
  type ErrorReport,
} from '@/lib/error-tracker';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';

export default function CrashReportsScreen() {
  const [reports, setReports] = React.useState<ErrorReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const loadReports = React.useCallback(async () => {
    try {
      setLoading(true);
      const errorReports = await getErrorReports();
      setReports(errorReports);
    } catch (error) {
      console.error('Failed to load error reports:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Reports',
      'Are you sure you want to clear all crash reports? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearErrorReports();
            setReports([]);
          },
        },
      ]
    );
  };

  const handleDeleteReport = (id: string) => {
    Alert.alert('Delete Report', 'Are you sure you want to delete this report?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteErrorReport(id);
          await loadReports();
        },
      },
    ]);
  };

  const handleCopyReport = async (report: ErrorReport) => {
    const reportText = JSON.stringify(report, null, 2);
    await Clipboard.setStringAsync(reportText);
    Alert.alert('Copied', 'Error report copied to clipboard');
  };

  const handleShareReports = async () => {
    try {
      const reportsJson = await exportErrorReports();

      // For web, copy to clipboard
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(reportsJson);
        Alert.alert('Copied', 'All error reports copied to clipboard');
        return;
      }

      // For mobile, use sharing
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        // Create a temporary file and share it
        const { File, Paths } = await import('expo-file-system');
        const filename = `error-reports-${new Date().toISOString().split('T')[0]}.json`;
        const file = new File(Paths.cache, filename);
        file.create();
        file.write(reportsJson);

        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Share Error Reports',
        });
      } else {
        // Fallback to clipboard
        await Clipboard.setStringAsync(reportsJson);
        Alert.alert('Copied', 'All error reports copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to share reports:', error);
      Alert.alert('Error', 'Failed to share error reports');
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Crash Reports',
          headerLeft: () => (
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full"
              onPress={() => router.back()}
            >
              <Icon as={ChevronLeftIcon} className="size-5" />
            </Button>
          ),
          headerRight: () => (
            <View className="flex-row gap-1">
              {reports.length > 0 && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full"
                    onPress={handleShareReports}
                  >
                    <Icon as={Share2Icon} className="size-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full"
                    onPress={handleClearAll}
                  >
                    <Icon as={TrashIcon} className="size-5 text-destructive" />
                  </Button>
                </>
              )}
            </View>
          ),
        }}
      />

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {loading ? (
          <View className="items-center justify-center py-20">
            <Text className="text-muted-foreground">Loading...</Text>
          </View>
        ) : reports.length === 0 ? (
          <View className="items-center justify-center py-20">
            <Icon as={AlertCircleIcon} className="size-16 text-muted-foreground mb-4" />
            <Text className="text-xl font-semibold mb-2">No Crash Reports</Text>
            <Text className="text-muted-foreground text-center">
              When errors occur, they'll be listed here for debugging
            </Text>
          </View>
        ) : (
          <View className="gap-3 pb-6">
            <View className="bg-secondary/50 rounded-lg p-3 mb-2">
              <Text className="text-sm text-muted-foreground">
                Total Reports: {reports.length}
              </Text>
            </View>

            {reports.map((report) => (
              <View key={report.id} className="bg-card rounded-lg border border-border overflow-hidden">
                <Pressable
                  onPress={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  className="p-4"
                >
                  <View className="flex-row items-start gap-3">
                    <Icon
                      as={AlertCircleIcon}
                      className="size-5 text-destructive mt-0.5"
                    />
                    <View className="flex-1">
                      <Text className="font-semibold mb-1">{report.error.name}</Text>
                      <Text className="text-sm text-muted-foreground mb-2">
                        {report.error.message}
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        <View className="bg-secondary rounded px-2 py-1">
                          <Text className="text-xs">{report.context.action}</Text>
                        </View>
                        {report.context.component && (
                          <View className="bg-secondary rounded px-2 py-1">
                            <Text className="text-xs">{report.context.component}</Text>
                          </View>
                        )}
                        <View className="bg-secondary rounded px-2 py-1">
                          <Text className="text-xs">{report.context.platform}</Text>
                        </View>
                      </View>
                      <Text className="text-xs text-muted-foreground mt-2">
                        {formatDate(report.timestamp)}
                      </Text>
                    </View>
                  </View>

                  {expandedId === report.id && (
                    <View className="mt-4 pt-4 border-t border-border">
                      {report.error.stack && (
                        <View className="mb-3">
                          <Text className="text-sm font-semibold mb-2">Stack Trace:</Text>
                          <ScrollView
                            horizontal
                            className="bg-secondary/50 rounded p-3"
                          >
                            <Text className="text-xs font-mono">
                              {report.error.stack}
                            </Text>
                          </ScrollView>
                        </View>
                      )}

                      {report.context.additionalInfo && (
                        <View className="mb-3">
                          <Text className="text-sm font-semibold mb-2">Additional Info:</Text>
                          <View className="bg-secondary/50 rounded p-3">
                            <Text className="text-xs font-mono">
                              {JSON.stringify(report.context.additionalInfo, null, 2)}
                            </Text>
                          </View>
                        </View>
                      )}

                      <View className="flex-row gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onPress={() => handleCopyReport(report)}
                        >
                          <Icon as={CopyIcon} className="size-4 mr-2" />
                          <Text>Copy</Text>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onPress={() => handleDeleteReport(report.id)}
                        >
                          <Icon as={TrashIcon} className="size-4 mr-2 text-destructive" />
                          <Text className="text-destructive">Delete</Text>
                        </Button>
                      </View>
                    </View>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
