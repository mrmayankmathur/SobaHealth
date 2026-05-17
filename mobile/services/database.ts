import * as SQLite from "expo-sqlite";

export interface UserProfile {
  id: number;
  name: string;
  age: number;
  gender: string;
  blood_group: string;
  conditions: string;
  allergies: string;
  preferred_language: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  language: string;
  created_at: number;
}

export interface HealthRecordRow {
  id: string;
  type: string;
  extracted_data: string;
  summary: string;
  created_at: number;
}

export async function initDatabase() {
  const db = await SQLite.openDatabaseAsync("sobahealth.db");

  // Define all tables on Day 1
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY,
      name TEXT,
      age INTEGER,
      gender TEXT,
      blood_group TEXT,
      conditions TEXT,  -- JSON array
      allergies TEXT,   -- JSON array
      preferred_language TEXT DEFAULT 'en'
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at INTEGER,
      session_type TEXT  -- 'health' | 'symptom' | 'nutrition'
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      role TEXT,
      content TEXT,
      language TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS health_records (
      id TEXT PRIMARY KEY,
      type TEXT,  -- 'lab' | 'prescription' | 'vaccination'
      extracted_data TEXT,  -- JSON
      summary TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS health_trends (
      id TEXT PRIMARY KEY,
      metric TEXT,  -- 'bp_systolic' | 'glucose' | 'weight'
      value REAL,
      unit TEXT,
      recorded_at INTEGER
    );
  `);

  return db;
}

// =============================================================================
// User Profile
// =============================================================================

export async function getUserProfile() {
  const db = await SQLite.openDatabaseAsync("sobahealth.db");
  const profile = await db.getFirstAsync<UserProfile>(
    "SELECT * FROM user_profile LIMIT 1",
  );
  return profile;
}

export async function saveUserProfile(profile: any) {
  const db = await SQLite.openDatabaseAsync("sobahealth.db");

  const existing = await getUserProfile();
  if (existing) {
    await db.runAsync(
      `UPDATE user_profile SET name=?, age=?, gender=?, blood_group=?, conditions=?, allergies=?, preferred_language=? WHERE id=?`,
      [
        profile.name,
        profile.age,
        profile.gender,
        profile.blood_group,
        JSON.stringify(profile.conditions || []),
        JSON.stringify(profile.allergies || []),
        profile.preferred_language || "en",
        existing.id,
      ],
    );
  } else {
    await db.runAsync(
      `INSERT INTO user_profile (name, age, gender, blood_group, conditions, allergies, preferred_language) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.name,
        profile.age,
        profile.gender,
        profile.blood_group,
        JSON.stringify(profile.conditions || []),
        JSON.stringify(profile.allergies || []),
        profile.preferred_language || "en",
      ],
    );
  }
}

// =============================================================================
// Chat History
// =============================================================================

export async function getChatMessages(
  limit: number = 50,
): Promise<ChatMessageRow[]> {
  const db = await SQLite.openDatabaseAsync("sobahealth.db");
  return db.getAllAsync<ChatMessageRow>(
    `SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
}

export async function saveChatMessage(msg: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  language: string;
}): Promise<void> {
  const db = await SQLite.openDatabaseAsync("sobahealth.db");
  await db.runAsync(
    `INSERT OR REPLACE INTO chat_messages (id, session_id, role, content, language, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [msg.id, msg.sessionId, msg.role, msg.content, msg.language, Date.now()],
  );
}

export async function clearChatHistory(): Promise<void> {
  const db = await SQLite.openDatabaseAsync("sobahealth.db");
  await db.runAsync("DELETE FROM chat_messages");
  await db.runAsync("DELETE FROM chat_sessions");
}

// =============================================================================
// Health Records
// =============================================================================

export async function saveHealthRecord(record: {
  id: string;
  type: string;
  extractedData: any;
  summary: string;
}): Promise<void> {
  const db = await SQLite.openDatabaseAsync("sobahealth.db");
  await db.runAsync(
    `INSERT OR REPLACE INTO health_records (id, type, extracted_data, summary, created_at) VALUES (?, ?, ?, ?, ?)`,
    [
      record.id,
      record.type,
      JSON.stringify(record.extractedData),
      record.summary,
      Date.now(),
    ],
  );
}

export async function getHealthRecords(): Promise<HealthRecordRow[]> {
  const db = await SQLite.openDatabaseAsync("sobahealth.db");
  return db.getAllAsync<HealthRecordRow>(
    `SELECT * FROM health_records ORDER BY created_at DESC`,
  );
}

// =============================================================================
// Health Trends
// =============================================================================

export async function saveHealthTrend(
  metric: string,
  value: number,
  unit: string,
): Promise<void> {
  const db = await SQLite.openDatabaseAsync("sobahealth.db");
  const id = `${metric}-${Date.now()}`;
  await db.runAsync(
    `INSERT INTO health_trends (id, metric, value, unit, recorded_at) VALUES (?, ?, ?, ?, ?)`,
    [id, metric, value, unit, Date.now()],
  );
}

export async function getHealthTrends(
  metric: string,
): Promise<Array<{ value: number; unit: string; recorded_at: number }>> {
  const db = await SQLite.openDatabaseAsync("sobahealth.db");
  return db.getAllAsync(
    `SELECT value, unit, recorded_at FROM health_trends WHERE metric=? ORDER BY recorded_at ASC`,
    [metric],
  );
}
