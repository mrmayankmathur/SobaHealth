import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { TrendCard } from '../../components/TrendCard';
import { Mic, FileEdit, FileText, MessageSquare, Settings } from 'lucide-react-native';
import { getUserProfile, getHealthRecords, getHealthTrends } from '../../services/database';

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('User');
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const profile = await getUserProfile();
        if (profile?.name) {
          // Get first name
          setUserName(profile.name.split(' ')[0]);
        }
        
        const records = await getHealthRecords();
        setRecentRecords(records.slice(0, 3)); // show top 3 recent records

        const bpTrends = await getHealthTrends('Blood Pressure');
        if (bpTrends.length > 0) {
          const latest = bpTrends[bpTrends.length - 1];
          setTrends([{ metric: 'Blood Pressure', value: `${latest.value} ${latest.unit}`, status: 'normal' }]);
        } else {
          setTrends([{ metric: 'Blood Pressure', value: '-- / --', status: 'normal' }]);
        }
      } catch (error) {
        console.warn('Could not load data', error);
      }
    }
    loadData();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <ConnectionBadge status="connected" />
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => router.push('/onboarding')}
          >
            <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => router.push('/connect')}
          >
            <Settings size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Greeting */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>Good Morning, {userName}.</Text>
        <Text style={styles.subGreetingText}>How are you feeling today?</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/chat')}
        >
          <Mic size={20} color={Colors.primary} />
          <Text style={styles.actionText}>Quick Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/symptoms')}
        >
          <FileEdit size={20} color={Colors.primary} />
          <Text style={styles.actionText}>Log Symptom</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Trends */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Trends</Text>
        {trends.map((trend, i) => (
          <TrendCard key={i} metric={trend.metric} value={trend.value} status={trend.status} />
        ))}
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityList}>
          {recentRecords.length > 0 ? (
            recentRecords.map((record) => (
              <View key={record.id} style={styles.activityItem}>
                <FileText size={20} color={Colors.textSecondary} />
                <Text style={styles.activityText} numberOfLines={1}>
                  {record.type === 'lab' ? 'Scanned Lab Report' : record.type === 'nutrition' ? 'Analyzed Food' : 'Health Record'}
                  <Text style={styles.timeText}> ({new Date(record.created_at).toLocaleDateString()})</Text>
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.activityItem}>
              <Text style={styles.activityText}>No recent activity</Text>
            </View>
          )}
        </View>
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
    padding: Spacing.base,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerRight: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarText: {
    ...Typography.bodyPrimary,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  greetingSection: {
    marginBottom: Spacing.xl,
  },
  greetingText: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subGreetingText: {
    ...Typography.bodyPrimary,
    color: Colors.textSecondary,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  actionText: {
    ...Typography.bodyPrimary,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  activityList: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
  },
  activityText: {
    ...Typography.bodyPrimary,
    color: Colors.textPrimary,
  },
  timeText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
