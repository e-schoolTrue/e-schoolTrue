import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import path from "path";
import { ResultType } from "./command/index";
import { GradeCommand, BranchCommand, ClassRoomCommand, CourseCommand } from "./command/settingsCommand";
import { SyncConfig, SyncHistory } from './backend/services/backupService';
import { ScheduleCommand } from "#electron/command/scheduleCommand";
import fs from 'fs/promises';
import { ConfigService } from './backend/services/configService';
import { InscriptionFeeEntity } from './backend/entities/paymentConfig';
import { documentContentService } from './backend/services/document-content-service';
import { ICreateConfigParams } from './backend/types/note';
import { CentralizedPdfService } from './backend/services/centralizedPdfService';
import { protectedHandle, ADMIN_ONLY, PROFESSOR_WRITE, type Role } from './backend/security';
import type { AuditAction } from './backend/entities/audit-log';



// ====================================================
// FONCTIONS D'INITIALISATION
// ====================================================


// =================================================================
// FONCTIONS UTILITAIRES
// =================================================================

const handleError = (error: any, message: string): ResultType => {
  console.error("Erreur IPC:", message, error);
  return {
    success: false,
    message: `${message}: ${error.message}`,
    error: error instanceof Error ? error.message : String(error),
    data: null,
  };
};

// =================================================================
// AUDIT & RBAC (multi-utilisateur)
// =================================================================

const PROFESSOR_WRITE_EXACT = [
  "save-student",
  "update-student",
  "delete-student",
  "professor:create",
  "professor:update",
  "professor:delete",
  "professor:payment:create",
  "professor:payment:update"
];

// B1: canaux accessibles au rôle comptable (admin inclus).
const COMPTABLE_ALLOW: string[] = ["payment:", "expense:", "cash:", "comptabilite:", "bank:", "teacher:", "receipt:"];

const rolesForChannel = (channel: string): Role[] => {
  if (PROFESSOR_WRITE.some(prefix => channel.startsWith(prefix)) || PROFESSOR_WRITE_EXACT.includes(channel)) {
    return ["admin", "professor"];
  }
  if (COMPTABLE_ALLOW.some(prefix => channel.startsWith(prefix))) {
    return ["admin", "comptable"];
  }
  if (ADMIN_ONLY.some(prefix => channel.startsWith(prefix))) {
    return ["admin"];
  }
  return ["admin"];
};

const AUDIT_CHANNEL_ACTION: Record<string, AuditAction> = {
  "save-student": "create",
  "update-student": "update",
  "delete-student": "delete",
  "professor:create": "create",
  "professor:update": "update",
  "professor:delete": "delete",
  "professor:payment:create": "create",
  "professor:payment:update": "update",
  "grade:new": "create",
  "grade:update": "update",
  "grade:delete": "delete",
  "classRoom:new": "create",
  "classRoom:update": "update",
  "classRoom:delete": "delete",
  "branch:new": "create",
  "branch:update": "update",
  "branch:delete": "delete",
  "course:new": "create",
  "courseGroup:add": "create",
  "course:update": "update",
  "course:delete": "delete",
  "payment:create": "create",
  "payment:saveConfig": "update",
  "payment:saveCustomConfig": "update",
  "payment:deleteCustomConfig": "delete",
  "absence:add": "create",
  "absence:createBatch": "create",
  "homework:create": "create",
  "homework:update": "update",
  "homework:delete": "delete",
  "vacation:create": "create",
  "vacation:update": "update",
  "vacation:updateStatus": "update",
  "vacation:delete": "delete",
  "school:save": "update",
  "school:saveSettings": "update",
  "yearRepartition:create": "create",
  "yearRepartition:update": "update",
  "yearRepartition:delete": "delete",
  "yearRepartition:setCurrent": "update",
  "schedule:create": "create",
  "schedule:delete": "delete",
  "schedule-config:save": "create",
  "gradeEntry:bulkSave": "create",
  "grade-config:save": "create",
  "document-content:update": "update",
  "expense:create": "create",
  "expense:update": "update",
  "expense:delete": "delete",
  "cash:append": "create",
  "cash:closure:create": "create",
  "cash:register:create": "create",
  "bank:create": "create",
  "bank:update": "update",
  "bank:transaction:create": "create",
  "comptabilite:validate": "update",
  "receipt:generate": "create",
  "teacher:hourlog:create": "create",
  "teacher:hourlog:update": "update",
  "teacher:salaryslip:create": "create",
  "backup:create": "create",
  "backup:list": "system",
  "backup:restore": "update",
  "backup:import": "create",
  "backup:previewImport": "create",
  "backup:confirmImport": "update",
  "backup:delete": "delete",
  "backup:reveal": "system",
  "backup:exportTo": "create"
};

interface EntityAuditSpec {
  create: string;
  update: string;
  delete: string;
  keys: string[];
}

const AUDIT_ENTITY: Record<string, EntityAuditSpec> = {
  Student:          { create: "Création de l'élève",                update: "Mise à jour de l'élève",                delete: "Suppression de l'élève",                keys: ["firstname", "lastname"] },
  Professor:        { create: "Création du professeur",             update: "Mise à jour du professeur",             delete: "Suppression du professeur",             keys: ["firstname", "lastname"] },
  Grade:            { create: "Création du niveau",                 update: "Mise à jour du niveau",                 delete: "Suppression du niveau",                 keys: ["name"] },
  ClassRoom:        { create: "Création de la classe",              update: "Mise à jour de la classe",              delete: "Suppression de la classe",              keys: ["name"] },
  Branch:           { create: "Création de la filière",             update: "Mise à jour de la filière",             delete: "Suppression de la filière",             keys: ["name"] },
  Course:           { create: "Ajout de la matière",                update: "Mise à jour de la matière",             delete: "Suppression de la matière",             keys: ["name"] },
  InscriptionFee:   { create: "Création du frais d'inscription",    update: "Mise à jour du frais d'inscription",    delete: "Suppression du frais d'inscription",    keys: [] },
  TrancheConfig:    { create: "Création de la tranche",             update: "Mise à jour de la tranche",             delete: "Suppression de la tranche",             keys: [] },
  Absence:          { create: "Création de l'absence",              update: "Mise à jour de l'absence",              delete: "Suppression de l'absence",              keys: [] },
  Homework:         { create: "Création du devoir",                 update: "Mise à jour du devoir",                 delete: "Suppression du devoir",                 keys: ["description"] },
  Vacation:         { create: "Demande de congé",                   update: "Mise à jour du congé",                  delete: "Suppression du congé",                  keys: ["reason"] },
  GradeEntry:       { create: "Enregistrement de la note",          update: "Mise à jour de la note",                delete: "Suppression de la note",                keys: [] },
  School:           { create: "Création de l'école",                update: "Mise à jour des informations de l'école", delete: "Suppression de l'école",               keys: ["name"] },
  YearRepartition:  { create: "Création de l'année scolaire",       update: "Mise à jour de l'année scolaire",       delete: "Suppression de l'année scolaire",       keys: ["schoolYear"] },
  Schedule:         { create: "Création du créneau",                update: "Mise à jour du créneau",                delete: "Suppression du créneau",                keys: [] },
  ScheduleConfig:   { create: "Configuration de l'emploi du temps enregistrée", update: "Configuration de l'emploi du temps modifiée", delete: "Configuration de l'emploi du temps supprimée", keys: [] },
  NoteConfig:       { create: "Configuration de notation modifiée", update: "Configuration de notation modifiée",    delete: "Configuration de notation supprimée",    keys: [] },
  DocumentContent:  { create: "Modèle de document créé",            update: "Modèle de document mis à jour",         delete: "Modèle de document supprimé",           keys: [] },
  Payment:          { create: "Création du paiement",               update: "Mise à jour du paiement",               delete: "Suppression du paiement",               keys: [] },
  ProfessorPayment: { create: "Paiement professeur enregistré",     update: "Paiement professeur mis à jour",        delete: "Paiement professeur supprimé",          keys: [] },
  Expense:          { create: "Création de la dépense",             update: "Mise à jour de la dépense",             delete: "Suppression de la dépense",             keys: ["label"] },
  CashMovement:     { create: "Mouvement de caisse enregistré",     update: "Mouvement de caisse mis à jour",        delete: "Suppression du mouvement de caisse",    keys: [] },
  CashRegister:     { create: "Registre de caisse créé",            update: "Registre de caisse mis à jour",         delete: "Registre de caisse supprimé",           keys: ["name"] },
  CashClosure:      { create: "Clôture de caisse enregistrée",      update: "Clôture de caisse mise à jour",         delete: "Suppression de la clôture de caisse",   keys: [] },
  BankAccount:      { create: "Compte bancaire créé",               update: "Compte bancaire mis à jour",            delete: "Compte bancaire supprimé",              keys: ["accountNumber"] },
  BankTransaction:  { create: "Transaction bancaire enregistrée",   update: "Transaction bancaire mise à jour",      delete: "Suppression de la transaction bancaire", keys: [] },
  TeacherHourLog:   { create: "Heures enseignant enregistrées",     update: "Heures enseignant mises à jour",       delete: "Suppression des heures enseignant",     keys: [] },
  SalarySlip:       { create: "Bulletin de paie créé",              update: "Bulletin de paie mis à jour",           delete: "Suppression du bulletin de paie",       keys: [] },
  ReceiptCounter:   { create: "Compteur de reçus initialisé",       update: "Compteur de reçus mis à jour",         delete: "Suppression du compteur de reçus",      keys: [] },
  FeeItem:          { create: "Élément de frais créé",              update: "Élément de frais mis à jour",           delete: "Suppression de l'élément de frais",   keys: ["name"] },
  Backup:           { create: "Sauvegarde locale créée",             update: "Base locale restaurée",                 delete: "Sauvegarde locale supprimée",           keys: [] }
};

interface AuditSummary {
  targetId?: string | number | null;
  summary: string;
  diff?: { before?: unknown; after?: unknown };
  metadata?: Record<string, unknown>;
}

const pickField = (source: any, key: string): string => {
  if (!source || typeof source !== "object") {
    return "";
  }
  const value = source[key];
  return value === undefined || value === null || value === "" ? "" : String(value);
};

const auditFor = (channel: string, entity: string, override?: {
  summarize?: (args: any[], result: any) => AuditSummary;
}): { action: AuditAction; entity: string; summarize: (args: any[], result: any) => AuditSummary } => {
  const action = AUDIT_CHANNEL_ACTION[channel] ?? "update";
  const actionKey = action === "create" || action === "delete" ? action : "update";
  const spec = AUDIT_ENTITY[entity] ?? { create: "Création", update: "Mise à jour", delete: "Suppression", keys: [] };
  const summarize: (args: any[], result: any) => AuditSummary = override?.summarize ?? ((args, result) => {
    const payload = args[0] ?? {};
    let data = result?.data ?? result ?? {};
    if (Array.isArray(data)) {
      data = data.find((item: any) =>
        (payload?.name !== undefined && item?.name === payload.name) ||
        (payload?.code !== undefined && item?.code === payload.code)
      ) ?? {};
    }
    const name = spec.keys.map(key => pickField(data, key) || pickField(payload, key)).filter(Boolean).join(" ");
    return {
      targetId: payload?.id ?? data?.id ?? (typeof args[0] === "number" ? args[0] : null),
      summary: (name ? `${spec[actionKey]} ${name}` : spec[actionKey]).trim()
    };
  });
  return { action, entity, summarize };
};

// =================================================================
// FONCTION D'ENREGISTREMENT DES HANDLERS
// =================================================================

export function registerIpcHandlers() {

  // --- Document Content ---
  ipcMain.handle("document-content:get", async () => {
    try {
      const content = await documentContentService.get();
      return { success: true, data: content };
    } catch (error) {
      return handleError(error, "document-content:get");
    }
  });

  protectedHandle("document-content:update", {
    roles: rolesForChannel("document-content:update"),
    audit: auditFor("document-content:update", "DocumentContent")
  }, async (_, data) => {
    try {
      const updatedContent = await documentContentService.update(data);
      return { success: true, data: updatedContent };
    } catch (error) {
      return handleError(error, "document-content:update");
    }
  });


  // --- Authentification ---
  ipcMain.handle("auth:create", async (_, userData) => global.authService.createSupervisor(userData.username, userData.password, userData.securityQuestion, userData.securityAnswer));
  ipcMain.handle("auth:getSecurityQuestion", async (_, { username }) => global.authService.getSecurityQuestion(username));
  ipcMain.handle("auth:resetPassword", async (_, { username, newPassword }) => global.authService.resetPassword(username, newPassword));
  protectedHandle("auth:validateSecurityAnswer", {
    roles: ['admin', 'professor', 'student'],
    auth: 'optional',
    audit: {
      action: 'system',
      entity: 'User',
      summarize: (args, result) => ({
        targetId: args[0]?.username ?? null,
        summary: `Validation de la réponse de sécurité de ${args[0]?.username ?? 'utilisateur'}`
      })
    }
  }, async (_, { username, answer }) => global.authService.validateSecurityAnswer(username, answer));
  ipcMain.handle("auth:login", async (_, credentials) => {
    const result = await global.authService.validateSupervisor(credentials.username, credentials.password);
    try {
      if (result?.success) {
        const user = result.data;
        await global.auditLogService?.record({
          action: 'login',
          targetEntity: 'User',
          targetId: user?.id ?? null,
          summary: `Connexion de ${user?.username ?? credentials.username}`,
          actor: user ? { id: user.id, username: user.username, role: user.role, displayName: user.displayName ?? null } : null
        });
      } else {
        await global.auditLogService?.record({
          action: 'login',
          targetEntity: 'User',
          summary: `Échec : ${result?.message ?? 'Connexion refusée'}`,
          metadata: { status: 'error' },
          actor: null
        });
      }
    } catch (auditError) {
      console.warn('[Audit] Échec de l\'enregistrement pour auth:login:', auditError);
    }
    return result;
  });

  // --- Authentification Supabase ---
  ipcMain.handle("auth:createSupabaseAccount", async (_, { email, password }) => global.authService.createSupabaseAccount(email, password));
  ipcMain.handle("auth:loginSupabase", async (_, { email, password }) => global.authService.signInWithSupabase(email, password));
  protectedHandle("auth:signOut", {
    roles: ['admin', 'professor', 'student', 'comptable'],
    // Idempotent : ne jamais throw UNAUTHENTICATED quand la session est déjà vide.
    // Le bouton cloud (SyncView) et le menu utilisateur (UserMenu) appellent tous deux
    // ce canal en best-effort ; un double-clic ou une session déjà purgée retourne success.
    auth: 'optional',
    audit: {
      action: 'logout',
      entity: 'User',
      summarize: (args, result, ctx) => ({
        targetId: ctx.actor?.id ?? null,
        summary: ctx.actor ? `Déconnexion de ${ctx.actor.username}` : 'Déconnexion (session déjà vide)'
      })
    }
  }, async () => {
    try {
      // signOutFromSupabase() est déjà best-effort (offline => purge locale quand même).
      await global.authService.signOutFromSupabase();
      await global.authService.logout();
      return {
        success: true,
        message: "Déconnexion réussie",
        data: null,
        error: null
      };
    } catch {
      // Idempotence : même en cas d'erreur inattendue, purger le local et retourner success
      // afin de ne jamais bloquer le frontend sur une session fantôme.
      try { await global.authService.logout(); } catch { /* best-effort */ }
      return {
        success: true,
        message: "Déconnexion locale effectuée",
        data: null,
        error: null
      };
    }
  });
  // Déconnexion cloud seule (Supabase) : utilisée par SyncView pour couper le cloud
  // sans tuer la session locale (users:list reste accessible après un signOut cloud).
  // Idempotente elle aussi (auth: 'optional').
  protectedHandle("auth:signOutCloud", {
    roles: ['admin', 'professor', 'student', 'comptable'],
    auth: 'optional',
    audit: {
      action: 'logout',
      entity: 'User',
      summarize: (args, result, ctx) => ({
        targetId: ctx.actor?.id ?? null,
        summary: ctx.actor ? `Déconnexion cloud de ${ctx.actor.username}` : 'Déconnexion cloud (session déjà vide)'
      })
    }
  }, async () => {
    try {
      await global.authService.signOutFromSupabase();
    } catch {
      // best-effort : signOutFromSupabase purge déjà le local en finally.
    }
    return {
      success: true,
      message: "Déconnexion cloud réussie",
      data: null,
      error: null
    };
  });
  ipcMain.handle("auth:checkStatus", async () => {
    const localUser = await global.authService.getCurrentUser();
    const isCloudConnected = await global.authService.isSupabaseSessionValid();
    const isSupabaseAvailable = await global.backupService.checkSupabaseAvailability();
    return {
      success: true,
      data: {
        isAuthenticated: !!localUser,
        user: localUser,
        supabaseStatus: { isAvailable: isSupabaseAvailable, isConnected: isCloudConnected }
      },
      message: "Statut vérifié", error: null
    };
  });

  // --- Sauvegarde / Synchro (Backup) ---

  ipcMain.handle('sync:now', async (): Promise<{ success: boolean; data?: SyncHistory; error?: string }> => {
    try {
      const user = await global.backupService.getSupabaseAuthUser();
      if (!user?.id) {
        return { success: false, error: 'Utilisateur non authentifié. Veuillez vous connecter au cloud.' };
      }

      const syncResult = await global.backupService.performBidirectionalSync(user.id);

      if (syncResult.status === 'failed') {
        return { success: false, data: syncResult, error: syncResult.error_message || 'La synchronisation a échoué.' };
      }

      return { success: true, data: syncResult };
    } catch (error) {
      return handleError(error, "sync:now");
    }
  });

  // [OK] Récupère l'historique des synchronisations
  ipcMain.handle('sync:getHistory', async (): Promise<{ success: boolean; data?: SyncHistory[]; error?: string }> => {
    try {
      // Vérifier d'abord si l'utilisateur est connecté localement
      const isConnected = await global.authService.isSupabaseSessionValid();
      if (!isConnected) {
        // Pas de session valide = pas d'historique, retourner un tableau vide
        return { success: true, data: [] };
      }

      // Essayer de récupérer l'utilisateur avec un timeout
      const user = await Promise.race([
        global.backupService.getSupabaseAuthUser(),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);

      if (!user?.id) {
        return { success: true, data: [] };
      }

      const history = await global.backupService.getLocalSyncHistory(user.id);
      return { success: true, data: history };
    } catch (error) {
      console.warn('Erreur lors de la récupération de l\'historique:', error);
      // En cas d'erreur, retourner un tableau vide plutôt qu'une erreur
      return { success: true, data: [] };
    }
  });

  // [OK] Récupère la configuration de la synchronisation
  ipcMain.handle('sync:getConfig', async (): Promise<{ success: boolean; data?: SyncConfig; error?: string }> => {
    try {
      const config = await global.backupService.loadSyncConfig();
      return { success: true, data: config };
    } catch (error) {
      return handleError(error, "sync:getConfig");
    }
  });

  // [OK] Met à jour la configuration de la synchronisation
  ipcMain.handle('sync:updateConfig', async (_event, newConfig: Partial<SyncConfig>): Promise<{ success: boolean; error?: string }> => {
    if (!newConfig) {
      return { success: false, error: 'Aucune configuration fournie.' };
    }
    try {
      await global.backupService.updateSyncConfig(newConfig);
      return { success: true };
    } catch (error) {
      return handleError(error, "sync:updateConfig");
    }
  });

  // --- Sauvegardes locales (fichier .zip : database.db + uploads/) ---
  // Rétention illimitée : aucune purge automatique, suppression manuelle uniquement.
  // Sécurité : le renderer ne transmet que des basenames ; le main reconstruit les chemins
  // (LocalBackupService.resolveBackupFile) + confirmed===true exigé pour restore/import.

  protectedHandle("backup:create", {
    roles: rolesForChannel("backup:create"),
    audit: auditFor("backup:create", "Backup")
  }, async () => {
    try {
      return await global.localBackupService.createBackup('manual');
    } catch (error) {
      return handleError(error, "backup:create");
    }
  });
  protectedHandle("backup:list", {
    roles: rolesForChannel("backup:list"),
    audit: auditFor("backup:list", "Backup", {
      summarize: () => ({ targetId: null, summary: "Consultation des sauvegardes locales" })
    })
  }, async () => {
    try {
      return await global.localBackupService.listBackups();
    } catch (error) {
      return handleError(error, "backup:list");
    }
  });
  protectedHandle("backup:restore", {
    roles: rolesForChannel("backup:restore"),
    audit: auditFor("backup:restore", "Backup")
  }, async (_, basename: string, confirmed: boolean) => {
    try {
      return await global.localBackupService.restoreBackup(basename, confirmed);
    } catch (error) {
      return handleError(error, "backup:restore");
    }
  });
  const previewImportHandler = async () => {
    try {
      return await global.localBackupService.previewImport();
    } catch (error) {
      return handleError(error, "backup:import");
    }
  };
  protectedHandle("backup:import", {
    roles: rolesForChannel("backup:import"),
    audit: auditFor("backup:import", "Backup")
  }, previewImportHandler);
  protectedHandle("backup:previewImport", {
    roles: rolesForChannel("backup:previewImport"),
    audit: auditFor("backup:previewImport", "Backup")
  }, previewImportHandler);
  protectedHandle("backup:confirmImport", {
    roles: rolesForChannel("backup:confirmImport"),
    audit: auditFor("backup:confirmImport", "Backup")
  }, async (_, stagingPath: string, confirmed: boolean) => {
    try {
      return await global.localBackupService.confirmImport(stagingPath, confirmed);
    } catch (error) {
      return handleError(error, "backup:confirmImport");
    }
  });
  protectedHandle("backup:delete", {
    roles: rolesForChannel("backup:delete"),
    audit: auditFor("backup:delete", "Backup")
  }, async (_, basename: string) => {
    try {
      return await global.localBackupService.deleteBackup(basename);
    } catch (error) {
      return handleError(error, "backup:delete");
    }
  });
  protectedHandle("backup:reveal", {
    roles: rolesForChannel("backup:reveal"),
    audit: auditFor("backup:reveal", "Backup", {
      summarize: (args) => ({
        targetId: typeof args[0] === "string" ? args[0] : null,
        summary: `Affichage de la sauvegarde ${String(args[0] ?? "")} dans l'explorateur`.trim()
      })
    })
  }, async (_, basename: string) => {
    try {
      return await global.localBackupService.revealBackup(basename);
    } catch (error) {
      return handleError(error, "backup:reveal");
    }
  });
  protectedHandle("backup:exportTo", {
    roles: rolesForChannel("backup:exportTo"),
    audit: auditFor("backup:exportTo", "Backup")
  }, async (_, basename: string) => {
    try {
      return await global.localBackupService.exportBackup(basename);
    } catch (error) {
      return handleError(error, "backup:exportTo");
    }
  });

  // --- Grades & Salles de classe ---
  ipcMain.handle("grade:all", async () => global.gradeService.getGrades());
  ipcMain.handle("grade:getAllGrades", async () => {
    try {
      return await global.gradeService.getGrades();
    } catch (error) {
      return handleError(error, "grade:getAllGrades");
    }
  });
  protectedHandle("grade:new", {
    roles: rolesForChannel("grade:new"),
    audit: auditFor("grade:new", "Grade")
  }, async (_, command: GradeCommand) => global.gradeService.newGrade(command));
  protectedHandle("grade:update", {
    roles: rolesForChannel("grade:update"),
    audit: auditFor("grade:update", "Grade")
  }, async (_, command: GradeCommand) => global.gradeService.updateGrade(command));
  protectedHandle("grade:delete", {
    roles: rolesForChannel("grade:delete"),
    audit: auditFor("grade:delete", "Grade")
  }, async (_, id: number) => global.gradeService.deleteGrade(id));
  protectedHandle("classRoom:new", {
    roles: rolesForChannel("classRoom:new"),
    audit: auditFor("classRoom:new", "ClassRoom")
  }, async (_, command: ClassRoomCommand) => global.gradeService.newClassRoom(command));
  protectedHandle("classRoom:delete", {
    roles: rolesForChannel("classRoom:delete"),
    audit: auditFor("classRoom:delete", "ClassRoom")
  }, async (_, id: number) => global.gradeService.deleteClassRoom(id));
  protectedHandle("classRoom:update", {
    roles: rolesForChannel("classRoom:update"),
    audit: auditFor("classRoom:update", "ClassRoom")
  }, async (_, command: ClassRoomCommand) => global.gradeService.updateClassRoom(command));
  ipcMain.handle("classRoom:all", async () => global.gradeService.getClassRooms());
  protectedHandle("branch:new", {
    roles: rolesForChannel("branch:new"),
    audit: auditFor("branch:new", "Branch")
  }, async (_, command: BranchCommand) => global.gradeService.newBranch(command));
  protectedHandle("branch:update", {
    roles: rolesForChannel("branch:update"),
    audit: auditFor("branch:update", "Branch")
  }, async (_, command: BranchCommand) => global.gradeService.updateBranch(command));
  protectedHandle("branch:delete", {
    roles: rolesForChannel("branch:delete"),
    audit: auditFor("branch:delete", "Branch")
  }, async (_, id: number) => global.gradeService.deleteBranch(id));


  // --- Cours ---
  protectedHandle("course:new", {
    roles: rolesForChannel("course:new"),
    audit: auditFor("course:new", "Course")
  }, async (_, command: CourseCommand) => global.courseService.newCourse(command));
  protectedHandle("courseGroup:add", {
    roles: rolesForChannel("courseGroup:add"),
    audit: auditFor("courseGroup:add", "Course")
  }, async (_, command: CourseCommand) => global.courseService.addCourseToGroupement(command));
  protectedHandle("course:update", {
    roles: rolesForChannel("course:update"),
    audit: auditFor("course:update", "Course")
  }, async (_, command: CourseCommand) =>
    global.courseService.updateCourse({
      id: command.id!,
      data: {
        name: command.name!,
        coefficient: command.coefficient,
        code: command.code!,
        gradeId: command.gradeId,
        gradeIds: command.gradeIds
      }
    })
  );
  protectedHandle("course:delete", {
    roles: rolesForChannel("course:delete"),
    audit: auditFor("course:delete", "Course")
  }, async (_, id: number) => global.courseService.deleteCourse(id));
  ipcMain.handle("course:all", async () => global.courseService.getAllCourse());
  ipcMain.handle("course:getByGrade", async (_, gradeId: number) => global.courseService.getCoursesByGrade(gradeId));

  // --- Étudiants ---
  ipcMain.handle("student:all", async (_, options?: {
    page?: number;
    pageSize?: number;
    filters?: {
      studentFullName?: string;
      grade?: string;
    };
  }) => {
    try {
      const defaultOptions = {
        page: options?.page || 1,
        pageSize: options?.pageSize || 1000,
        filters: options?.filters || {}
      };

      const { students, total } = await global.studentService.getAllStudents(defaultOptions);

      // P0 FIX: always return consistent envelope {success, data:{students,total}, error, message}
      // Frontend callers are made tolerant to both array and object shapes for backward compat.
      return { success: true, data: { students, total }, error: null, message: "Étudiants récupérés" };
    } catch (error) {
      return handleError(error, "student:all");
    }
  });
  ipcMain.handle("student:getDetails", async (_, studentId: number) => global.studentService.getStudentDetails(studentId));
  protectedHandle("save-student", {
    roles: rolesForChannel("save-student"),
    audit: auditFor("save-student", "Student", {
      summarize: (args, result) => {
        const payload = args[0] ?? {};
        const data = result?.data ?? {};
        const name = [data?.firstname, payload?.firstname, data?.lastname, payload?.lastname].filter(v => v).join(" ");
        return {
          targetId: payload?.id ?? data?.id ?? null,
          summary: (payload?.id ? "Mise à jour de l'élève" : "Création de l'élève") + (name ? ` ${name}` : "")
        };
      }
    })
  }, async (_, studentData) => studentData.id ? global.studentService.updateStudent(studentData.id, studentData) : global.studentService.createStudent(studentData));
  protectedHandle("update-student", {
    roles: rolesForChannel("update-student"),
    audit: auditFor("update-student", "Student")
  }, async (_, { studentId, studentData }) => global.studentService.updateStudent(studentId, studentData));
  protectedHandle("delete-student", {
    roles: rolesForChannel("delete-student"),
    audit: auditFor("delete-student", "Student")
  }, async (_, studentId: number) => global.studentService.deleteStudent(studentId));
  ipcMain.handle("student:getByGrade", async (_, gradeId: number) => global.studentService.getStudentsByGrade(gradeId));
  ipcMain.handle("student:search", async (_, query: string) => global.studentService.searchStudents(query));

  // --- Professeurs ---
  ipcMain.handle("professor:all", async () => global.professorService.getAllProfessors());
  protectedHandle("professor:create", {
    roles: rolesForChannel("professor:create"),
    audit: auditFor("professor:create", "Professor")
  }, async (_, professorData) => global.professorService.createProfessor(professorData));
  protectedHandle("professor:update", {
    roles: rolesForChannel("professor:update"),
    audit: auditFor("professor:update", "Professor")
  }, async (_, { id, data }) => global.professorService.updateProfessor(id, data));
  protectedHandle("professor:delete", {
    roles: rolesForChannel("professor:delete"),
    audit: auditFor("professor:delete", "Professor")
  }, async (_, professorId: number) => global.professorService.deleteProfessor(professorId));
  ipcMain.handle("professor:getById", async (_, professorId: number) => global.professorService.getProfessorById(professorId));
  ipcMain.handle("professor:search", async (_, query: string) => global.professorService.searchProfessors(query));
  ipcMain.handle("professor:count", async () => global.professorService.getTotalProfessors());
  ipcMain.handle("professor:getByCourseAndGrade", async (_, { courseId, gradeId }: { courseId: number, gradeId: number }) => 
    global.professorService.getProfessorByCourseAndGrade(courseId, gradeId)
  );

  // --- Fichiers ---

  ipcMain.handle('file:upload', async (_event, fileData: { name: string; type: string; content: string }) => {
    try {
      const result = await global.fileService.saveFile({
        name: fileData.name,
        type: fileData.type,
        content: fileData.content // Le contenu base64 doit être sauvegardé en base
      });

      return {
        success: true,
        data: result,
        message: 'Fichier uploadé avec succès',
        error: null
      };
    } catch (error) {
      return handleError(error, "Erreur lors de l'upload du fichier");
    }
  });
  ipcMain.handle("getStudentPhoto", async (_event: Electron.IpcMainInvokeEvent, photoId: number): Promise<ResultType> => {
    try {
      const photo = await global.fileService.getFileById({ fileId: photoId });
      if (!photo) {
        return {
          success: false,
          data: null,
          error: "Photo non trouvée",
          message: "La photo n'a pas pu être récupérée"
        };
      }

      // Convertir le Buffer en base64
      const base64Content = photo.content.toString('base64');
      console.log("Taille du contenu base64:", base64Content.length);

      return {
        success: true,
        data: {
          content: base64Content,
          type: photo.type,
          name: photo.name
        },
        error: null,
        message: "Photo récupérée avec succès"
      };
    } catch (error) {
      return handleError(error, 'Erreur lors de la récupération de la photo de l\'étudiant');
    }
  });
  ipcMain.handle("student:downloadDocument", async (_event: Electron.IpcMainInvokeEvent, documentId: number): Promise<ResultType> => {
    try {
      const document = await global.fileService.getFileById({ fileId: documentId });
      if (!document) {
        return {
          success: false,
          data: null,
          error: "Document non trouvé",
          message: "Le document n'a pas pu être récupéré"
        };
      }

      // S'assurer que le contenu est un Buffer avant de le convertir en base64
      const content = Buffer.isBuffer(document.content)
        ? document.content.toString('base64')
        : Buffer.from(document.content).toString('base64');

      console.log('Type du document:', document.type);
      console.log('Nom du document:', document.name);
      console.log('Taille du contenu encodé:', content.length);

      return {
        success: true,
        data: {
          content: content,
          type: document.type,
          name: document.name
        },
        error: null,
        message: "Document récupéré avec succès"
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du document:', error);
      return handleError(error, 'Erreur lors de la récupération du document');
    }
  });
  ipcMain.handle("getProfessorPhoto", async (_event: Electron.IpcMainInvokeEvent, photoId: number): Promise<ResultType> => {
    try {
      const photo = await global.fileService.getFileById({ fileId: photoId });
      if (!photo) {
        return {
          success: false,
          data: null,
          error: "Photo non trouvée",
          message: "La photo n'a pas pu être récupérée"
        };
      }

      // Convertir le Buffer en base64
      const base64Content = photo.content.toString('base64');
      console.log("Taille du contenu base64:", base64Content.length);

      return {
        success: true,
        data: {
          content: base64Content,
          type: photo.type,
          name: photo.name
        },
        error: null,
        message: "Photo récupérée avec succès"
      };
    } catch (error) {
      return handleError(error, 'Erreur lors de la récupération de la photo du professeur');
    }
  });

  ipcMain.handle("school:getLogo", async (_event: Electron.IpcMainInvokeEvent, logoId: number): Promise<ResultType> => {
    try {
      const logo = await global.fileService.getFileById({ fileId: logoId });
      if (!logo) {
        return {
          success: false,
          data: null,
          error: "Logo non trouvé",
          message: "Le logo n'a pas pu être récupéré"
        };
      }

      return {
        success: true,
        data: {
          content: logo.content.toString('base64'),
          type: logo.type,
          name: logo.name
        },
        error: null,
        message: "Logo récupéré avec succès"
      };
    } catch (error) {
      return handleError(error, "Erreur lors de la récupération du logo");
    }
  });
  ipcMain.handle("professor:downloadDocument", async (_event: Electron.IpcMainInvokeEvent, documentId: number): Promise<ResultType> => {
    try {
      const document = await global.fileService.getFileById({ fileId: documentId });
      if (!document) {
        return {
          success: false,
          data: null,
          error: "Document non trouvé",
          message: "Le document n'a pas pu être récupéré"
        };
      }

      // ✅ CORRECTION : Utiliser le contenu stocké en base de données
      let base64Content: string;

      if (document.content) {
        // Si le contenu est déjà en base de données (Buffer ou string)
        base64Content = Buffer.isBuffer(document.content)
          ? document.content.toString('base64')
          : Buffer.from(document.content).toString('base64');
      } else if (document.path) {
        // Fallback : si le fichier physique existe encore
        try {
          const fileContent = await fs.readFile(document.path);
          base64Content = fileContent.toString('base64');
        } catch (fsError) {
          console.error('Fichier physique introuvable:', document.path);
          return {
            success: false,
            data: null,
            error: "Fichier physique introuvable",
            message: "Le document n'a pas pu être récupéré depuis le stockage"
          };
        }
      } else {
        return {
          success: false,
          data: null,
          error: "Aucune source de contenu disponible",
          message: "Le document ne contient ni contenu ni chemin valide"
        };
      }

      return {
        success: true,
        data: {
          content: base64Content,
          type: document.type,
          name: document.name
        },
        error: null,
        message: "Document récupéré avec succès"
      };
    } catch (error) {
      return handleError(error, 'Erreur lors de la récupération du document');
    }
  });


  ipcMain.handle("file:showInFolder", async (_, filePath: string) => shell.showItemInFolder(path.normalize(filePath)));

  // --- Paiements ---
  ipcMain.handle("payment:getConfigs", async () => global.paymentService.getConfigs());
  protectedHandle("payment:saveConfig", {
    roles: rolesForChannel("payment:saveConfig"),
    audit: auditFor("payment:saveConfig", "Payment", {
      summarize: (args, result) => ({
        targetId: result?.data?.id ?? null,
        summary: "Configuration de paiement mise à jour"
      })
    })
  }, async (_, configData) => global.paymentService.saveConfig(configData));

  // --- Configurations Personnalisées des Paiements ---
  ipcMain.handle("payment:getCustomConfigs", async () => global.paymentService.getCustomConfigs());
  protectedHandle("payment:saveCustomConfig", {
    roles: rolesForChannel("payment:saveCustomConfig"),
    audit: auditFor("payment:saveCustomConfig", "Payment", {
      summarize: (args, result) => ({
        targetId: result?.data?.id ?? args[0]?.id ?? null,
        summary: "Configuration personnalisée enregistrée"
      })
    })
  }, async (_, configData) => global.paymentService.saveCustomConfig(configData));
  protectedHandle("payment:deleteCustomConfig", {
    roles: rolesForChannel("payment:deleteCustomConfig"),
    audit: auditFor("payment:deleteCustomConfig", "Payment", {
      summarize: (args, result) => ({
        targetId: typeof args[0] === "number" ? args[0] : null,
        summary: "Suppression de la configuration personnalisée"
      })
    })
  }, async (_, configId) => global.paymentService.deleteCustomConfig(configId));

  ipcMain.handle("payment:getByStudent", async (_, studentId) => global.paymentService.getPaymentsByStudent(studentId));
  ipcMain.handle("payment:getByDate", async (_, date) => global.paymentService.getPaymentsByDate(date));
  protectedHandle("payment:create", {
    roles: rolesForChannel("payment:create"),
    audit: auditFor("payment:create", "Payment", {
      summarize: (args, result) => ({
        targetId: result?.data?.id ?? null,
        summary: args[0]?.amount != null ? `Encaissement de ${args[0].amount}` : "Encaissement d'un paiement"
      })
    })
  }, async (_, paymentData) => global.paymentService.addPayment(paymentData));
  ipcMain.handle("professor:payments:list", async (_, filters) => global.paymentService.getProfessorPayments(filters));
  ipcMain.handle("professor:payments:stats", async () => global.paymentService.getProfessorPaymentStats());
  protectedHandle("professor:payment:create", {
    roles: rolesForChannel("professor:payment:create"),
    audit: auditFor("professor:payment:create", "ProfessorPayment", {
      summarize: (args, result) => {
        const amount = args[0]?.amount ?? result?.data?.amount;
        return {
          targetId: result?.data?.id ?? null,
          summary: `Paiement professeur ${amount != null ? `de ${amount} enregistré` : "enregistré"}`
        };
      }
    })
  }, async (_, paymentData) => global.paymentService.addProfessorPayment(paymentData));
  protectedHandle("professor:payment:update", {
    roles: rolesForChannel("professor:payment:update"),
    audit: auditFor("professor:payment:update", "ProfessorPayment", {
      summarize: (args, result) => ({
        targetId: result?.data?.id ?? args[0]?.id ?? null,
        summary: "Paiement professeur mis à jour"
      })
    })
  }, async (_, paymentData) => global.paymentService.updateProfessorPayment(paymentData));

  // --- Tranch Configurations ---
  ipcMain.handle("tranche-config:all", async () => {
    try {
      // Assumes global.paymentAnnualConfigService is now available
      const configs = await global.paymentAnnualConfigService.findAll();
      return { success: true, data: configs };
    } catch (error) {
      return handleError(error, "tranche-config:all");
    }
  });

  // --- Absences ---
  ipcMain.handle("absence:allStudent", async () => global.absenceService.getAllAbsences("STUDENT"));
  ipcMain.handle("absence:allProfessor", async () => global.absenceService.getAllAbsences("PROFESSOR"));
  protectedHandle("absence:add", {
    roles: rolesForChannel("absence:add"),
    audit: auditFor("absence:add", "Absence")
  }, async (_, absenceData) => global.absenceService.addAbsence(absenceData));
  ipcMain.handle("absence:getTotalAbsencesGroupedByStudent", async (_, gradeId?: number) => global.absenceService.getTotalAbsencesGroupedByStudent(gradeId));
  protectedHandle("absence:createBatch", {
    roles: rolesForChannel("absence:createBatch"),
    audit: auditFor("absence:createBatch", "Absence", {
      summarize: (args, result) => ({
        targetId: null,
        summary: `Création de ${Array.isArray(args[0]) ? args[0].length : 0} absences`,
        metadata: {
          ids: Array.isArray(result?.data) ? result.data.map((a: any) => a?.id ?? null).filter((id: any) => id != null) : []
        }
      })
    })
  }, async (_, absencesData) => {
    try {
      const result = await global.absenceService.createProfessorAbsencesBatch(absencesData);
      return result;
    } catch (error) {
      return handleError(error, "Erreur lors de la création des absences en lot");
    }
  });

  // --- Devoirs (Homework) ---
  protectedHandle("homework:create", {
    roles: rolesForChannel("homework:create"),
    audit: auditFor("homework:create", "Homework")
  }, async (_, data) => global.homeworkService.createHomework(data));
  ipcMain.handle("homework:getByGrade", async (_, gradeId) => global.homeworkService.getHomeworkByGrade(gradeId));
  protectedHandle("homework:delete", {
    roles: rolesForChannel("homework:delete"),
    audit: auditFor("homework:delete", "Homework")
  }, async (_, id) => global.homeworkService.deleteHomework(id));
  protectedHandle("homework:update", {
    roles: rolesForChannel("homework:update"),
    audit: auditFor("homework:update", "Homework")
  }, async (_, data) => global.homeworkService.updateHomework(data.id, data));
  ipcMain.handle("homework:notify", async (_, data) => ({ success: true, message: "Notifications simulées envoyées." }));

  // --- Congés (Vacation) ---
  ipcMain.handle("vacation:getByStudent", async (_, studentId) => global.vacationService.getVacationsByStudent(studentId));
  ipcMain.handle("vacation:getByProfessor", async (_, professorId) => global.vacationService.getVacationsByProfessor(professorId));
  protectedHandle("vacation:create", {
    roles: rolesForChannel("vacation:create"),
    audit: auditFor("vacation:create", "Vacation")
  }, async (_, data) => global.vacationService.createVacation(data));
  protectedHandle("vacation:update", {
    roles: rolesForChannel("vacation:update"),
    audit: auditFor("vacation:update", "Vacation")
  }, async (_, data) => data.id && data.status ? global.vacationService.updateVacationStatus(data.id, data.status, data.comment) : { success: false, error: "INVALID_DATA" });
  protectedHandle("vacation:updateStatus", {
    roles: rolesForChannel("vacation:updateStatus"),
    audit: auditFor("vacation:updateStatus", "Vacation")
  }, async (_, { id, status, comment }) => global.vacationService.updateVacationStatus(id, status, comment));
  protectedHandle("vacation:delete", {
    roles: rolesForChannel("vacation:delete"),
    audit: auditFor("vacation:delete", "Vacation")
  }, async (_, id) => global.vacationService.deleteVacation(id));

  // --- Configuration ---
  ipcMain.handle("preference:get", async (_, key: string) => {
    try {
      const result = await global.preferenceService.getPreference(key);
      return { success: result.success, data: result.data, error: result.error };
    } catch (error) {
      return { success: false, data: null, error: String(error) };
    }
  });
  ipcMain.handle("preference:set", async (_, { key, value }: { key: string; value: string }) => {
    try {
      const result = await global.preferenceService.setPreference(key, value);
      return { success: result.success, data: result.data, error: result.error };
    } catch (error) {
      return { success: false, data: null, error: String(error) };
    }
  });
  ipcMain.handle('is-first-launch', () => {
    try {
      const isFirst = ConfigService.getInstance().isFirstLaunch();
      console.log(`[IPC] Réponse à 'is-first-launch': ${isFirst}`);
      return { success: true, data: isFirst, error: null, message: '' };
    } catch (error) {
      return handleError(error, 'is-first-launch');
    }
  });
  ipcMain.handle("set-first-launch-complete", () => {
    ConfigService.getInstance().setFirstLaunchComplete();
    return { success: true };
  });
  // Gestionnaire pour ouvrir le dialogue de sélection de dossier
  ipcMain.handle('open-file-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Sélectionner un dossier de stockage'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du dialogue de fichier:', error);
      throw error;
    }
  });

  // --- École ---
  ipcMain.handle("school:get", async () => global.schoolService.getSchool());
  protectedHandle("school:save", {
    roles: rolesForChannel("school:save"),
    audit: auditFor("school:save", "School", {
      summarize: (args, result) => ({
        targetId: result?.data?.id ?? null,
        summary: "Mise à jour des informations de l'école"
      })
    })
  }, async (_, schoolData) => global.schoolService.saveOrUpdateSchool(schoolData));
  protectedHandle("school:saveSettings", {
    roles: rolesForChannel("school:saveSettings"),
    audit: auditFor("school:saveSettings", "School", {
      summarize: (args, result) => ({
        targetId: result?.data?.id ?? null,
        summary: "Mise à jour des informations de l'école"
      })
    })
  }, async (_, settings) => global.schoolService.saveOrUpdateSettings(settings));

  // --- Dashboard ---
  ipcMain.handle("dashboard:stats", async () => global.dashboardService.getStats());
  ipcMain.handle("dashboard:paymentStats", async () => global.dashboardService.getPaymentStats());
  ipcMain.handle("dashboard:professorPaymentStats", async () => global.dashboardService.getProfessorPaymentStats());
  ipcMain.handle("dashboard:absenceStats", async () => global.dashboardService.getAbsenceStats());

  // --- Année Scolaire ---
  ipcMain.handle("yearRepartition:getAll", async () => global.yearRepartitionService.getAllYearRepartitions());
  ipcMain.handle("yearRepartition:getCurrent", async () => global.yearRepartitionService.getCurrentYearRepartition());
  protectedHandle("yearRepartition:create", {
    roles: rolesForChannel("yearRepartition:create"),
    audit: auditFor("yearRepartition:create", "YearRepartition")
  }, async (_, data) => global.yearRepartitionService.createYearRepartition(data));
  protectedHandle("yearRepartition:update", {
    roles: rolesForChannel("yearRepartition:update"),
    audit: auditFor("yearRepartition:update", "YearRepartition")
  }, async (_, { id, data }) => global.yearRepartitionService.updateYearRepartition(id, data));
  protectedHandle("yearRepartition:delete", {
    roles: rolesForChannel("yearRepartition:delete"),
    audit: auditFor("yearRepartition:delete", "YearRepartition")
  }, async (_, id) => global.yearRepartitionService.deleteYearRepartition(id));
  protectedHandle("yearRepartition:setCurrent", {
    roles: rolesForChannel("yearRepartition:setCurrent"),
    audit: auditFor("yearRepartition:setCurrent", "YearRepartition", {
      summarize: (args, result) => ({
        targetId: typeof args[0] === "number" ? args[0] : result?.data?.id ?? null,
        summary: `Année scolaire ${result?.data?.schoolYear ?? ""} définie comme courante`.trim()
      })
    })
  }, async (_, id) => global.yearRepartitionService.setCurrentYearRepartition(id));

  // --- Licence ---
  ipcMain.handle("license:getMachineId", async () => ({ success: true, data: { machineId: global.licenseService.getMachineId() } }));
  ipcMain.handle("license:activateMaster", async (_, code) => global.licenseService.activateMaster(code));
  ipcMain.handle("license:activateSub", async (_, packageText) => global.licenseService.activateSub(packageText));
  ipcMain.handle("license:generateSub", async (_, targetMachineId?: string) => {
    const result = await global.licenseService.generateSub(targetMachineId);
    return result.success
      ? { success: true, data: { subLicenseCode: result.data!.subLicenseCode } }
      : { success: false, error: result.message };
  });
  ipcMain.handle("license:removeSub", async (_, targetMachineId) => global.licenseService.removeSub(targetMachineId));
  ipcMain.handle("license:getStatus", async () => global.licenseService.getStatus());
  ipcMain.handle("license:getDetails", async () => global.licenseService.getDetails());

  // --- Administration ---
  protectedHandle("users:list", {
    roles: ['admin']
  }, async (_, params) => {
    const data = await global.userAdminService.list({
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
      search: params?.search
    });
    return { success: true, data, message: "Liste des utilisateurs", error: null };
  });

  protectedHandle("users:create", {
    roles: ['admin'],
    audit: {
      action: 'create',
      entity: 'User',
      summarize: (args, result) => ({
        targetId: result?.data?.id ?? null,
        summary: `Création du compte ${result?.data?.username ?? args[0]?.username ?? 'utilisateur'}`
      })
    }
  }, async (_, payload) => {
    const data = await global.userAdminService.create(payload);
    return { success: true, data, message: "Utilisateur créé avec succès", error: null };
  });

  protectedHandle("users:update", {
    roles: ['admin'],
    audit: {
      action: 'update',
      entity: 'User',
      before: (args) => global.userAdminService.getById(args[0]?.id),
      summarize: (args, result, ctx) => ({
        targetId: args[0]?.id ?? null,
        summary: `Mise à jour du compte ${result?.data?.username ?? (ctx.before as any)?.username ?? 'utilisateur'}`,
        diff: { before: ctx.before, after: result?.data }
      })
    }
  }, async (_, payload) => {
    const data = await global.userAdminService.update(payload);
    return { success: true, data, message: "Utilisateur mis à jour avec succès", error: null };
  });

  protectedHandle("users:setActive", {
    roles: ['admin'],
    audit: {
      action: 'status_change',
      entity: 'User',
      summarize: (args, result) => ({
        targetId: args[0]?.id ?? null,
        summary: args[0]?.isActive ? `Activation du compte ${result?.data?.username ?? 'utilisateur'}` : `Désactivation du compte ${result?.data?.username ?? 'utilisateur'}`
      })
    }
  }, async (_, payload) => {
    const data = await global.userAdminService.setActive(payload);
    return { success: true, data, message: "Statut mis à jour", error: null };
  });

  protectedHandle("users:resetPassword", {
    roles: ['admin'],
    audit: {
      action: 'password_reset',
      entity: 'User',
      summarize: (args, result) => ({
        targetId: args[0]?.id ?? null,
        summary: `Réinitialisation du mot de passe de ${result?.data?.username ?? 'utilisateur'}`
      })
    }
  }, async (_, payload) => {
    const data = await global.userAdminService.resetPassword(payload);
    return { success: true, data, message: "Mot de passe réinitialisé", error: null };
  });

  protectedHandle("audit:list", {
    roles: ['admin']
  }, async (_, params) => {
    const data = await global.auditLogService.list({
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
      filters: params?.filters ?? {}
    });
    return { success: true, data, message: "Journal d'audit", error: null };
  });


  //shedule
  // Handler pour créer un emploi du temps
  protectedHandle('schedule:create', {
    roles: rolesForChannel('schedule:create'),
    audit: auditFor('schedule:create', 'Schedule')
  }, async (event, command: ScheduleCommand) => {
    try {
      return await global.scheduleService.createSchedule(command);
    } catch (error) {
      console.error('Error in schedule:create handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la création du créneau',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handler pour récupérer l'emploi du temps par date
  ipcMain.handle('schedule:getByDate', async (event, { date }) => {
    try {
      return await global.scheduleService.getScheduleByDate(date);
    } catch (error) {
      console.error('Error in schedule:getByDate handler:', error);
      return {
        success: false,
        message: 'Erreur lors de la récupération de l\'emploi du temps',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handler pour récupérer tous les emplois du temps
  ipcMain.handle('schedule:all', async () => {
    try {
      return await global.scheduleService.getAllSchedules();
    } catch (error) {
      console.error('Error in schedule:all handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la récupération des emplois du temps',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handler pour récupérer l'emploi du temps par classe
  ipcMain.handle('schedule:by-class', async (event, classId: number) => {
    try {
      return await global.scheduleService.getScheduleByClass(classId);
    } catch (error) {
      console.error('Error in schedule:by-class handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la récupération de l\'emploi du temps de la classe',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handler pour supprimer un créneau
  protectedHandle('schedule:delete', {
    roles: rolesForChannel('schedule:delete'),
    audit: auditFor('schedule:delete', 'Schedule')
  }, async (event, scheduleId: number) => {
    try {
      return await global.scheduleService.deleteSchedule(scheduleId);
    } catch (error) {
      console.error('Error in schedule:delete handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la suppression du créneau',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // === SCHEDULE CONFIG HANDLERS ===
  ipcMain.handle('schedule-config:get', async (_event, { classId }) => {
    try {
      return await global.scheduleConfigService.getConfig(classId);
    } catch (error) {
      return { success: false, message: 'Erreur lors de la récupération', error };
    }
  });

  protectedHandle('schedule-config:save', {
    roles: rolesForChannel('schedule-config:save'),
    audit: auditFor('schedule-config:save', 'ScheduleConfig', {
      summarize: (args, result) => ({
        targetId: result?.data?.id ?? null,
        summary: "Configuration de l'emploi du temps enregistrée"
      })
    })
  }, async (_event, data) => {
    try {
      return await global.scheduleConfigService.saveConfig(data);
    } catch (error) {
      return { success: false, message: 'Erreur lors de l\'enregistrement', error };
    }
  });

  // ===================================================================
  // CONFIGURATION DES NOTES (ConfigNoteService)
  // ===================================================================
  
  // Sauvegarder une configuration de notation
  protectedHandle('grade-config:save', {
    roles: rolesForChannel('grade-config:save'),
    audit: auditFor('grade-config:save', 'NoteConfig')
  }, async (_event, params: ICreateConfigParams) => {
    try {
      return await global.configNoteService.saveConfig(params);
    } catch (error) {
      return handleError(error, "grade-config:save");
    }
  });

  // Récupérer la configuration applicable (avec cascade)
  ipcMain.handle('grade-config:get', async (_event, { schoolId, classId, subjectId, period }) => {
    try {
      return await global.configNoteService.getApplicableConfig({ schoolId, classId, subjectId, period });
    } catch (error) {
      return handleError(error, "grade-config:get");
    }
  });

  // ===================================================================
  // SAISIE DES NOTES (GradeEntryService)
  // ===================================================================

  // Sauvegarder plusieurs notes
  protectedHandle('gradeEntry:bulkSave', {
    roles: rolesForChannel('gradeEntry:bulkSave'),
    audit: auditFor('gradeEntry:bulkSave', 'GradeEntry', {
      summarize: (args, result) => {
        const count = Array.isArray(args[0]?.grades) ? args[0].grades.length : 0;
        return {
          targetId: args[0]?.studentId ?? null,
          summary: `Enregistrement de ${count} note${count > 1 ? "s" : ""}`,
          metadata: { count }
        };
      }
    })
  }, async (_event, input) => {
    try {
      console.log('=== IPC: gradeEntry:bulkSave called ===');
      console.log('Input:', input);

      const result = await global.gradeEntryService.bulkSaveGrades(input);
      console.log('Result from bulkSaveGrades:', result);

      if (!result.success) {
        console.error('❌ Erreur dans bulkSaveGrades:', result.error);
      }

      return result;
    } catch (error) {
      console.error('❌ IPC Error in gradeEntry:bulkSave:', error);
      return handleError(error, "gradeEntry:bulkSave");
    }
  });

  // Récupérer les notes d'un élève pour une matière
  ipcMain.handle('gradeEntry:get', async (_event, { studentId, courseId, period }) => {
    try {
      return await global.gradeEntryService.getGradeEntries({ studentId, courseId, period });
    } catch (error) {
      return handleError(error, "gradeEntry:get");
    }
  });

  // Calculer et mettre en cache la moyenne
  ipcMain.handle('gradeEntry:calculate', async (_event, { studentId, courseId, classId, schoolId, period }) => {
    try {
      return await global.gradeEntryService.calculateAndCacheGrade(studentId, courseId, classId, schoolId, period);
    } catch (error) {
      return handleError(error, "gradeEntry:calculate");
    }
  });

  // Récupérer toutes les moyennes d'un élève
  ipcMain.handle('gradeEntry:getStudentAverages', async (_event, { studentId, classId, schoolId, period }) => {
    try {
      return await global.gradeEntryService.getStudentAverages(studentId, classId, schoolId, period);
    } catch (error) {
      return handleError(error, "gradeEntry:getStudentAverages");
    }
  });

    ipcMain.handle('gradeEntry:getClassRankings', async (_event, { classId, schoolId, period }) => {
    try {
      return await global.gradeEntryService.getClassRankings(classId, schoolId, period);
    } catch (error) {
      return handleError(error, "gradeEntry:getClassRankings");
    }
  });

  // Handler pour obtenir les classements centralisés
  ipcMain.handle('gradeEntry:getCentralizedRankings', async (_event, filters) => {
    try {
      if (!filters || typeof filters !== 'object') {
        throw new Error('Filtres non valides');
      }

      if (filters.gradeId === undefined || filters.gradeId === null || isNaN(filters.gradeId)) {
        throw new Error('gradeId est requis et doit être un nombre valide');
      }

      const result = await global.gradeEntryService.getCentralizedRankings(filters);

      if (!result.success) {
        return result;
      }

      if (result.data && result.data.length === 0) {
        return {
          success: true,
          data: [],
          message: 'Aucun classement disponible pour les filtres sélectionnés',
          error: null
        };
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        success: false,
        data: null,
        message: `Erreur lors du calcul du classement centralisé: ${errorMessage}`,
        error: errorMessage
      };
    }
  });

  // Handler pour obtenir les classements annuels (Procès-Verbal Annuel)
  ipcMain.handle('gradeEntry:getAnnualRankings', async (_event, filters) => {
    try {
      if (!filters || typeof filters !== 'object') {
        throw new Error('Filtres non valides');
      }

      if (filters.gradeId === undefined || filters.gradeId === null || isNaN(filters.gradeId)) {
        throw new Error('gradeId est requis et doit être un nombre valide');
      }

      const result = await global.gradeEntryService.getAnnualRankings(filters);

      if (!result.success) {
        return result;
      }

      if (result.data && result.data.length === 0) {
        return {
          success: true,
          data: [],
          message: 'Aucun classement annuel disponible pour les filtres sélectionnés',
          error: null
        };
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        success: false,
        data: null,
        message: `Erreur lors du calcul du classement annuel: ${errorMessage}`,
        error: errorMessage
      };
    }
  });

  console.log('Tous les handlers IPC ont été enregistrés.');
}
