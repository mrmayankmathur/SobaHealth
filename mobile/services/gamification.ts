import { Alert } from 'react-native';
import { getUserProfile, updateUserGamification } from './database';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const AVAILABLE_BADGES: Record<string, Badge> = {
  first_chat: {
    id: 'first_chat',
    name: 'Ice Breaker',
    description: 'Had your first chat with the AI assistant.',
    icon: '💬',
  },
  first_scan: {
    id: 'first_scan',
    name: 'Data Miner',
    description: 'Scanned your first medical document or food.',
    icon: '📄',
  },
  symptom_logger: {
    id: 'symptom_logger',
    name: 'Body Listener',
    description: 'Logged a symptom for analysis.',
    icon: '🩺',
  },
  health_pro: {
    id: 'health_pro',
    name: 'Health Pro',
    description: 'Reached 500 XP.',
    icon: '🏆',
  }
};

/**
 * Calculate the user's level based on their total XP.
 * Simple RPG formula: Level = floor(sqrt(XP / 100)) + 1
 */
export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

/**
 * Calculate XP required for the *next* level.
 */
export function getNextLevelXP(currentLevel: number): number {
  return Math.pow(currentLevel, 2) * 100;
}

/**
 * Award XP to the user and check for badge unlocks.
 * @param amount The amount of XP to award.
 * @param action The action taken (e.g., 'scan', 'chat', 'symptom').
 */
export async function awardXP(amount: number, action?: string) {
  try {
    const profile = await getUserProfile();
    if (!profile) return; // User hasn't finished onboarding

    let currentXP = profile.xp || 0;
    let unlockedBadges: string[] = [];
    
    try {
      if (profile.unlocked_badges) {
        unlockedBadges = JSON.parse(profile.unlocked_badges);
      }
    } catch (e) {}

    const oldLevel = calculateLevel(currentXP);
    
    currentXP += amount;
    
    const newLevel = calculateLevel(currentXP);
    let newBadgeEarned: Badge | null = null;

    // Check action-based badges
    if (action === 'chat' && !unlockedBadges.includes('first_chat')) {
      unlockedBadges.push('first_chat');
      newBadgeEarned = AVAILABLE_BADGES.first_chat;
    } else if (action === 'scan' && !unlockedBadges.includes('first_scan')) {
      unlockedBadges.push('first_scan');
      newBadgeEarned = AVAILABLE_BADGES.first_scan;
    } else if (action === 'symptom' && !unlockedBadges.includes('symptom_logger')) {
      unlockedBadges.push('symptom_logger');
      newBadgeEarned = AVAILABLE_BADGES.symptom_logger;
    }

    // Check milestone badges
    if (currentXP >= 500 && !unlockedBadges.includes('health_pro')) {
      unlockedBadges.push('health_pro');
      // If we earned multiple in one go, just show the milestone one for the alert to keep it simple
      newBadgeEarned = AVAILABLE_BADGES.health_pro;
    }

    // Save to database
    await updateUserGamification(currentXP, unlockedBadges);

    // Notify user of milestones
    if (newLevel > oldLevel) {
      Alert.alert('Level Up! 🎉', `You are now Level ${newLevel}! Keep up the healthy habits.`);
    } else if (newBadgeEarned) {
      Alert.alert('New Badge Unlocked! 🏅', `${newBadgeEarned.icon} ${newBadgeEarned.name}\n${newBadgeEarned.description}`);
    }

  } catch (error) {
    console.warn('Failed to award XP:', error);
  }
}
