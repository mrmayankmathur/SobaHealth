import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { getHealthRecords, type HealthRecordRow } from '../../services/database';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { Search, Plus, FileText, Pill, Syringe } from 'lucide-react-native';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  lab: { icon: <FileText size={20} color={Colors.primary} />, label: 'Lab Report', color: Colors.primary },
  prescription: { icon: <Pill size={20} color={Colors.warning} />, label: 'Prescription', color: Colors.warning },
  vaccination: { icon: <Syringe size={20} color={Colors.success} />, label: 'Vaccination', color: Colors.success },
};

export default function RecordsScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<HealthRecordRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Mock group records by month
  const groupedRecords = records.reduce((acc, record) => {
    const date = new Date(record.created_at);
    const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(record);
    return acc;
  }, {} as Record<string, HealthRecordRow[]>);

  const filteredGroups = Object.keys(groupedRecords).reduce((acc, monthYear) => {
    const filtered = groupedRecords[monthYear].filter(record => 
      record.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (TYPE_CONFIG[record.type]?.label || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length > 0) acc[monthYear] = filtered;
    return acc;
  }, {} as Record<string, HealthRecordRow[]>);

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <ConnectionBadge status="connected" />
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/(tabs)/scan')}
          >
            <Plus size={16} color={Colors.textPrimary} style={{ marginRight: 4 }} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Health Records</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search records..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {Object.keys(filteredGroups).length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={48} color={Colors.border} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or add a new record.</Text>
          </View>
        ) : (
          Object.keys(filteredGroups).map(monthYear => (
            <View key={monthYear} style={styles.monthGroup}>
              <View style={styles.monthHeaderRow}>
                <Text style={styles.monthText}>-- {monthYear} </Text>
                <View style={styles.monthLine} />
              </View>

              {filteredGroups[monthYear].map(record => {
                const config = TYPE_CONFIG[record.type] || TYPE_CONFIG.lab;
                return (
                  <View key={record.id} style={styles.recordCard}>
                    <View style={styles.recordIconBox}>
                      {config.icon}
                    </View>
                    <View style={styles.recordDetails}>
                      <Text style={styles.recordTitle} numberOfLines={1}>{config.label}</Text>
                      <Text style={styles.recordSummary} numberOfLines={1}>{record.summary}</Text>
                      <Text style={styles.recordMeta}>Date: {formatDate(record.created_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  addButtonText: {
    ...Typography.micro,
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  headerTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
    paddingBottom: Spacing.sm,
  },
  searchContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    ...Typography.bodyPrimary,
    color: Colors.textPrimary,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: Spacing.base,
    paddingBottom: Spacing.huge,
  },
  monthGroup: {
    marginBottom: Spacing.xl,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  monthText: {
    ...Typography.micro,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  monthLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
    borderStyle: 'dashed',
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  recordIconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  recordDetails: {
    flex: 1,
  },
  recordTitle: {
    ...Typography.bodyPrimary,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  recordSummary: {
    ...Typography.micro,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  recordMeta: {
    ...Typography.micro,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.huge * 2,
  },
  emptyTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.bodyPrimary,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

