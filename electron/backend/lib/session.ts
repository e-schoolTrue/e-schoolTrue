// src/lib/session.ts
let currentSupabaseUserId: string | null = null;

export function getCurrentSupabaseUserId(): string | null {
  return currentSupabaseUserId;
}

export function setCurrentSupabaseUserId(userId: string | null): void {
  currentSupabaseUserId = userId;
  if(userId) {
    console.log(`[Session State] ID utilisateur Supabase défini sur : ${userId}`);
  } else {
    console.log(`[Session State] ID utilisateur Supabase nettoyé.`);
  }
}