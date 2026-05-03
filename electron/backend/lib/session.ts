// src/lib/session.ts
let currentSupabaseUserId: string | null = null;
let currentSchemaName: string | null = null;

export function getCurrentSupabaseUserId(): string | null {
  return currentSupabaseUserId;
}

export function setCurrentSupabaseUserId(userId: string | null): void {
  currentSupabaseUserId = userId;
  if (userId) {
    console.log(`[Session] ID utilisateur Supabase defini: ${userId}`);
  } else {
    console.log(`[Session] ID utilisateur Supabase nettoye.`);
    currentSchemaName = null;
  }
}

export function getCurrentSchemaName(): string | null {
  return currentSchemaName;
}

export function setCurrentSchemaName(schemaName: string | null): void {
  currentSchemaName = schemaName;
  console.log(`[Session] Schema actif: ${schemaName ?? '(aucun)'}`);
}

export function onSchoolSelected(schoolId: string, schemaName?: string) {
  global.activeSchoolId = schoolId;

  if (schemaName) {
    setCurrentSchemaName(schemaName);
  }

  global.backupService?.setActiveSchool(schoolId, schemaName);
}