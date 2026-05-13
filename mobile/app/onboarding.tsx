import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '../constants/theme';
import { saveUserProfile } from '../services/database';

export default function OnboardingScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!name || !age) {
      alert('Please provide at least your name and age.');
      return;
    }

    setIsSaving(true);
    try {
      await saveUserProfile({
        name,
        age: parseInt(age, 10) || 0,
        gender,
        conditions: conditions.split(',').map(s => s.trim()).filter(Boolean),
        allergies: allergies.split(',').map(s => s.trim()).filter(Boolean),
      });
      router.replace('/(tabs)');
    } catch (e) {
      alert('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Health Profile</Text>
        <Text style={styles.subtitle}>Help Aivaan provide personalized advice.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Age</Text>
          <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="Your age" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Gender</Text>
          <TextInput style={styles.input} value={gender} onChangeText={setGender} placeholder="Male / Female / Other" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Medical Conditions (comma separated)</Text>
          <TextInput style={styles.input} value={conditions} onChangeText={setConditions} placeholder="e.g. Diabetes, Hypertension" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Allergies (comma separated)</Text>
          <TextInput style={styles.input} value={allergies} onChangeText={setAllergies} placeholder="e.g. Peanuts, Penicillin" placeholderTextColor={Colors.textMuted} />

          <TouchableOpacity style={styles.button} onPress={handleSave} disabled={isSaving}>
            <Text style={styles.buttonText}>{isSaving ? 'Saving...' : 'Save & Continue'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xxl,
    paddingTop: 80,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxxl,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.xxl,
    ...Shadows.md,
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
});
