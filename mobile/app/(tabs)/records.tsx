/**
 * Health Records — Unified view of extracted medical documents.
 * Shows lab reports, prescriptions, and vaccinations extracted by Gemma 4 Vision.
 * Data is stored locally in SQLite — never leaves the device.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadows,
} from '../../constants/theme';
import { getHealthRecords, type HealthRecordRow } from '../../services/database';

const TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  lab: { emoji: '🧪', label: 'Lab Report', color: '#8B5CF6' },
  prescription: { emoji: '💊', label: 'Prescription', color: Colors.primary },
  vaccination: { emoji: '💉', label: 'Vaccination', color: Colors.safe },
};

export default function RecordsScreen() {
  const [records, setRecords] = useState<HealthRecordRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    try {
      const data = await getHealthRecords();
      setRecords(data);
    } catch (e) {
      console.warn('Failed to load records:', e);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  if (records.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📋 Health Records</Text>
          <Text style={styles.headerSubtitle}>
            Your medical documents — stored locally
          </Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No Records Yet</Text>
          <Text style={styles.emptyDesc}>
            Scan a medical document using the Scan tab.{'\n'}
            Gemma 4 will extract the data and save it here.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 Health Records</Text>
        <Text style={styles.headerSubtitle}>
          {records.length} record{records.length !== 1 ? 's' : ''} — stored locally
        </Text>
      </View>

      {records.map((record) => {
        const config = TYPE_CONFIG[record.type] || TYPE_CONFIG.lab;
        const isExpanded = expandedId === record.id;
        let parsedData: any = null;
        try {
          parsedData = JSON.parse(record.extracted_data);
        } catch {}

        return (
          <TouchableOpacity
            key={record.id}
            style={styles.recordCard}
            onPress={() => toggleExpand(record.id)}
            activeOpacity={0.7}
          >
            <View style={styles.recordHeader}>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: config.color + '20' },
                ]}
              >
                <Text style={styles.typeEmoji}>{config.emoji}</Text>
              </View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordType}>{config.label}</Text>
                <Text style={styles.recordDate}>
                  {formatDate(record.created_at)}
                </Text>
              </View>
              <Text style={styles.expandIcon}>
                {isExpanded ? '▲' : '▼'}
              </Text>
            </View>

            {/* Summary always visible */}
            <Text style={styles.recordSummary} numberOfLines={isExpanded ? undefined : 3}>
              {record.summary}
            </Text>

            {/* Extracted data (expanded) */}
            {isExpanded && parsedData && (
              <View style={styles.dataSection}>
                <Text style={styles.dataLabel}>🔍 Extracted Data</Text>
                <Text style={styles.dataContent} selectable>
                  {JSON.stringify(parsedData, null, 2)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🔒 All records are stored locally on your device
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: 56,
    paddingBottom: 120,
  },
  emptyContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: 56,
    flex: 1,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  recordCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeEmoji: {
    fontSize: 20,
  },
  recordInfo: {
    flex: 1,
  },
  recordType: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recordDate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  expandIcon: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  recordSummary: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  dataSection: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
  },
  dataLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  dataContent: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingBottom: 100,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
