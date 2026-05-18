import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { getHealthRecords, type HealthRecordRow } from '../../services/database';
import { ArrowLeft, FileText } from 'lucide-react-native';

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [record, setRecord] = useState<HealthRecordRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsedData, setParsedData] = useState<any>(null);

  useEffect(() => {
    loadRecord();
  }, [id]);

  async function loadRecord() {
    try {
      const records = await getHealthRecords();
      const found = records.find(r => r.id === id);
      if (found) {
        setRecord(found);
        try {
          if (found.extracted_data) {
            setParsedData(JSON.parse(found.extracted_data));
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Error loading record details:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Record not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Record Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Spacing.huge }}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FileText size={24} color={Colors.primary} />
            <Text style={styles.cardTitle}>{record.type.toUpperCase()}</Text>
          </View>
          <Text style={styles.summaryText}>{record.summary}</Text>
          <Text style={styles.dateText}>
            Recorded on: {new Date(record.created_at).toLocaleDateString()}
          </Text>
        </View>

        {parsedData && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Extracted Data</Text>
            
            {/* Display findings / lab results */}
            {parsedData.findings && Array.isArray(parsedData.findings) && (
              <View style={styles.dataSection}>
                <Text style={styles.subTitle}>Findings:</Text>
                {parsedData.findings.map((finding: any, idx: number) => (
                  <View key={idx} style={styles.rowItem}>
                    <Text style={styles.rowLabel}>{finding.test_name || 'Test'}</Text>
                    <Text style={[styles.rowValue, finding.status === 'high' || finding.status === 'low' ? styles.alertText : null]}>
                      {finding.value} {finding.unit}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Display medications */}
            {parsedData.medications && Array.isArray(parsedData.medications) && (
              <View style={styles.dataSection}>
                <Text style={styles.subTitle}>Medications:</Text>
                {parsedData.medications.map((med: any, idx: number) => (
                  <View key={idx} style={styles.rowItem}>
                    <Text style={styles.rowLabel}>{med.name || 'Medicine'}</Text>
                    <Text style={styles.rowValue}>{med.dosage} - {med.frequency}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Display other generic keys */}
            {Object.keys(parsedData).map(key => {
              if (key === 'findings' || key === 'medications' || key === 'summary') return null;
              const val = parsedData[key];
              if (typeof val === 'string' && val) {
                return (
                  <View key={key} style={styles.rowItem}>
                    <Text style={styles.rowLabel}>{key.replace(/_/g, ' ').toUpperCase()}:</Text>
                    <Text style={styles.rowValue}>{val}</Text>
                  </View>
                );
              }
              return null;
            })}
          </View>
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  content: {
    padding: Spacing.base,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  summaryText: {
    ...Typography.bodyPrimary,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  dateText: {
    ...Typography.micro,
    color: Colors.textSecondary,
  },
  detailsCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  dataSection: {
    marginBottom: Spacing.md,
  },
  subTitle: {
    ...Typography.bodyPrimary,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rowLabel: {
    ...Typography.bodyPrimary,
    color: Colors.textPrimary,
    flex: 1,
  },
  rowValue: {
    ...Typography.bodyPrimary,
    color: Colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  alertText: {
    color: Colors.emergency,
    fontWeight: 'bold',
  },
  errorText: {
    ...Typography.bodyPrimary,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  backButtonText: {
    ...Typography.bodyPrimary,
    color: '#FFF',
    fontWeight: 'bold',
  }
});