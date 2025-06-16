import { ipcMain, dialog, shell } from 'electron';
import * as fs from "fs/promises";
import path from "path";
import { ResultType } from "./command/index";
import { GradeCommand, BranchCommand, ClassRoomCommand, CourseCommand } from "./command/settingsCommand";

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
// FONCTION D'ENREGISTREMENT DES HANDLERS
// =================================================================

export function registerIpcHandlers() {
  console.log('Enregistrement des handlers IPC...');

  // --- Authentification ---
  ipcMain.handle("auth:create", async (_, userData) => global.authService.createSupervisor(userData.username, userData.password, userData.securityQuestion, userData.securityAnswer));
  ipcMain.handle("auth:validate", async (_, { username, password }) => global.authService.validateSupervisor(username, password));
  ipcMain.handle("auth:getSecurityQuestion", async (_, { username }) => global.authService.getSecurityQuestion(username));
  ipcMain.handle("auth:validateSecurityAnswer", async (_, { username, answer }) => global.authService.validateSecurityAnswer(username, answer));
  ipcMain.handle("auth:resetPassword", async (_, { username, newPassword }) => global.authService.resetPassword(username, newPassword));
  ipcMain.handle("auth:login", async (_, credentials) => global.authService.validateSupervisor(credentials.username, credentials.password));

  // --- Authentification Supabase ---
  ipcMain.handle("auth:createSupabaseAccount", async (_, { email, password }) => global.authService.createSupabaseAccount(email, password));
  ipcMain.handle("auth:loginSupabase", async (_, { email, password }) => global.authService.signInWithSupabase(email, password));
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
  ipcMain.handle("backup:create", async (_, name) => global.backupService.createBackup(name));
  
  ipcMain.handle("backup:history", async () => global.backupService.getLocalSyncHistory(String((await global.authService.getSupabaseAuthUser())?.id)));
  ipcMain.handle("backup:config:get", async () => global.backupService.loadSyncConfig());
  ipcMain.handle("backup:config:update", async (_, config) => global.backupService.updateSyncConfig(config));
  ipcMain.handle("backup:checkConnection", async () => ({ success: true, data: { isAvailable: await global.backupService.checkSupabaseAvailability() } }));
  ipcMain.handle("backup:sync", async () => {
    const authUser = await global.backupService.getSupabaseAuthUser();
    if (!authUser) return { success: false, error: 'NOT_AUTHENTICATED', message: 'Utilisateur non connecté au cloud.' };
    return global.backupService.performBidirectionalSync(authUser.id);
  });

  // --- Grades & Salles de classe ---
  ipcMain.handle("grade:all", async () => global.gradeService.getGrades());
  ipcMain.handle("grade:new", async (_, command: GradeCommand) => global.gradeService.newGrade(command));
  ipcMain.handle("grade:update", async (_, command: GradeCommand) => global.gradeService.updateGrade(command));
  ipcMain.handle("grade:delete", async (_, id: number) => global.gradeService.deleteGrade(id));
  ipcMain.handle("classRoom:new", async (_, command: ClassRoomCommand) => global.gradeService.newClassRoom(command));
  ipcMain.handle("classRoom:delete", async (_, id: number) => global.gradeService.deleteClassRoom(id));
  ipcMain.handle("classRoom:update", async (_, command: ClassRoomCommand) => global.gradeService.updateClassRoom(command));
  ipcMain.handle("classRoom:all", async () => global.gradeService.getClassRooms());
  ipcMain.handle("branch:new", async (_, command: BranchCommand) => global.gradeService.newBranch(command));
  ipcMain.handle("branch:update", async (_, command: BranchCommand) => global.gradeService.updateBranch(command));
  ipcMain.handle("branch:delete", async (_, id: number) => global.gradeService.deleteBranch(id));

  // --- Cours ---
  ipcMain.handle("course:new", async (_, command: CourseCommand) => global.courseService.newCourse(command));
  ipcMain.handle("courseGroup:add", async (_, command: CourseCommand) => global.courseService.addCourseToGroupement(command));
  ipcMain.handle("course:update", async (_, command: CourseCommand) => global.courseService.updateCourse({ id: command.id!, data: { name: command.name!, coefficient: command.coefficient, code: command.code! } }));
  ipcMain.handle("course:delete", async (_, id: number) => global.courseService.deleteCourse(id));
  ipcMain.handle("course:all", async () => global.courseService.getAllCourse());

  // --- Étudiants ---
  ipcMain.handle("student:all", async () => ({ success: true, data: await global.studentService.getAllStudents(), message: "Étudiants récupérés" }));
  ipcMain.handle("student:getDetails", async (_, studentId: number) => global.studentService.getStudentDetails(studentId));
  ipcMain.handle("save-student", async (_, studentData) => studentData.id ? global.studentService.updateStudent(studentData.id, studentData) : global.studentService.createStudent(studentData));
  ipcMain.handle("update-student", async (_, { studentId, studentData }) => global.studentService.updateStudent(studentId, studentData));
  ipcMain.handle("delete-student", async (_, studentId: number) => global.studentService.deleteStudent(studentId));
  ipcMain.handle("student:getByGrade", async (_, gradeId: number) => global.studentService.getStudentsByGrade(gradeId));
  ipcMain.handle("student:getById", async (_, studentId: number) => global.studentService.getStudentById(studentId));
  ipcMain.handle("student:search", async (_, query: string) => global.studentService.searchStudents(query));

  // --- Professeurs ---
  ipcMain.handle("professor:all", async () => global.professorService.getAllProfessors());
  ipcMain.handle("professor:create", async (_, professorData) => global.professorService.createProfessor(professorData));
  ipcMain.handle("professor:update", async (_, { id, data }) => global.professorService.updateProfessor(id, data));
  ipcMain.handle("professor:delete", async (_, professorId: number) => global.professorService.deleteProfessor(professorId));
  ipcMain.handle("professor:getById", async (_, professorId: number) => global.professorService.getProfessorById(professorId));
  ipcMain.handle("professor:search", async (_, query: string) => global.professorService.searchProfessors(query));
  ipcMain.handle("professor:count", async () => global.professorService.getTotalProfessors());

  // --- Fichiers ---
  ipcMain.handle("file:upload", async (_, fileData) => ({ success: true, data: await global.fileService.saveFile(fileData) }));
  ipcMain.handle("getStudentPhoto", async (_, photoId: number) => global.fileService.getFileById({ fileId: photoId }));
  ipcMain.handle("getProfessorPhoto", async (_, photoId: number) => global.fileService.getFileById({ fileId: photoId }));
  ipcMain.handle("school:getLogo", async (_, logoId: number) => global.fileService.getFileById({ fileId: logoId }));
  ipcMain.handle("file:showInFolder", async (_, filePath: string) => shell.showItemInFolder(path.normalize(filePath)));

  // --- Paiements ---
  ipcMain.handle("payment:getConfigs", async () => global.paymentService.getConfigs());
  ipcMain.handle("payment:saveConfig", async (_, configData) => global.paymentService.saveConfig(configData));
  ipcMain.handle("payment:getByStudent", async (_, studentId) => global.paymentService.getPaymentsByStudent(studentId));
  ipcMain.handle("payment:getConfig", async (_, classId) => global.paymentService.getConfigByClass(String(classId)));
  ipcMain.handle("payment:create", async (_, paymentData) => global.paymentService.addPayment(paymentData));
  ipcMain.handle("payment:getRemainingAmount", async (_, studentId) => global.paymentService.getRemainingAmount(studentId));
  ipcMain.handle("professor:payments:list", async (_, filters) => global.paymentService.getProfessorPayments(filters));
  ipcMain.handle("professor:payments:stats", async () => global.paymentService.getProfessorPaymentStats());
  ipcMain.handle("professor:payment:create", async (_, paymentData) => global.paymentService.addProfessorPayment(paymentData));
  ipcMain.handle("professor:payment:update", async (_, paymentData) => global.paymentService.updateProfessorPayment(paymentData));
  ipcMain.handle("professor:payment:getById", async (_, paymentId) => global.paymentService.getProfessorPaymentById(paymentId));
  
  // --- Absences ---
  ipcMain.handle("absence:allStudent", async () => global.absenceService.getAllAbsences("STUDENT"));
  ipcMain.handle("absence:allProfessor", async () => global.absenceService.getAllAbsences("PROFESSOR"));
  ipcMain.handle("absence:addStudent", async (_, absenceData) => global.absenceService.addAbsence(absenceData));
  ipcMain.handle("absence:addProfessor", async (_, data) => global.absenceService.createProfessorAbsence(data));
  ipcMain.handle("absence:updateProfessor", async (_, data) => global.absenceService.updateProfessorAbsence(data));
  ipcMain.handle("absence:getAllProfessor", async () => global.absenceService.getAllProfessorAbsences());
  ipcMain.handle("absence:deleteProfessor", async (_, id) => global.absenceService.deleteProfessorAbsence(id));
  
  // --- Devoirs (Homework) ---
  ipcMain.handle("homework:create", async (_, data) => global.homeworkService.createHomework(data));
  ipcMain.handle("homework:getByGrade", async (_, gradeId) => global.homeworkService.getHomeworkByGrade(gradeId));
  ipcMain.handle("homework:delete", async (_, id) => global.homeworkService.deleteHomework(id));
  ipcMain.handle("homework:update", async (_, data) => global.homeworkService.updateHomework(data.id, data));
  ipcMain.handle("homework:notify", async (_, data) => ({ success: true, message: "Notifications simulées envoyées." }));
  
  // --- Congés (Vacation) ---
  ipcMain.handle("vacation:getByStudent", async (_, studentId) => global.vacationService.getVacationsByStudent(studentId));
  ipcMain.handle("vacation:getByProfessor", async (_, professorId) => global.vacationService.getVacationsByProfessor(professorId));
  ipcMain.handle("vacation:create", async (_, data) => global.vacationService.createVacation(data));
  ipcMain.handle("vacation:update", async (_, data) => data.id && data.status ? global.vacationService.updateVacationStatus(data.id, data.status, data.comment) : { success: false, error: "INVALID_DATA" });
  ipcMain.handle("vacation:updateStatus", async (_, { id, status, comment }) => global.vacationService.updateVacationStatus(id, status, comment));
  ipcMain.handle("vacation:delete", async (_, id) => global.vacationService.deleteVacation(id));
  
  // --- Bulletins (Report Card) ---
  ipcMain.handle("report:generateMultiple", async (_, data) => global.reportCardService.generateReportCards(data));
  ipcMain.handle("report:preview", async (_, data) => global.reportCardService.generateReportCards({ studentIds: [data.studentId], period: data.period, templateId: "preview" }));
  ipcMain.handle("grades:save", async (_, data) => global.reportCardService.saveStudentGrades(data));
  ipcMain.handle("grades:get", async (_, { studentId, period }) => global.reportCardService.getStudentGrades(studentId, period));
  
  // --- Configuration ---
  ipcMain.handle("gradeConfig:save", async (_, config) => global.gradeConfigService.saveConfiguration(config));
  ipcMain.handle("gradeConfig:get", async (_, { gradeId }) => global.gradeConfigService.getConfigurationByGrade(gradeId));
  ipcMain.handle("preference:saveTemplate", async (_, templateId) => global.preferenceService.saveTemplatePreference(templateId));
  ipcMain.handle("preference:getTemplate", async () => global.preferenceService.getTemplatePreference());
  ipcMain.handle("is-first-launch", async () => ({ success: true, data: await global.configService.isFirstLaunchCheck() }));
  ipcMain.handle("set-first-launch-complete", async () => global.configService.setFirstLaunchComplete());
  ipcMain.handle("save-configuration", async (_, data) => global.configService.saveConfiguration(data));
  
  // --- École ---
  ipcMain.handle("school:get", async () => global.schoolService.getSchool());
  ipcMain.handle("school:save", async (_, schoolData) => global.schoolService.saveOrUpdateSchool(schoolData));
  ipcMain.handle("school:saveSettings", async (_, settings) => global.schoolService.saveOrUpdateSettings(settings));

  // --- Dashboard ---
  ipcMain.handle("dashboard:stats", async () => global.dashboardService.getStats());
  ipcMain.handle("dashboard:paymentStats", async () => global.dashboardService.getPaymentStats());
  ipcMain.handle("dashboard:absenceStats", async () => global.dashboardService.getAbsenceStats());

  // --- Année Scolaire ---
  ipcMain.handle("yearRepartition:getAll", async () => global.yearRepartitionService.getAllYearRepartitions());
  ipcMain.handle("yearRepartition:getCurrent", async () => global.yearRepartitionService.getCurrentYearRepartition());
  ipcMain.handle("yearRepartition:create", async (_, data) => global.yearRepartitionService.createYearRepartition(data));
  ipcMain.handle("yearRepartition:update", async (_, { id, data }) => global.yearRepartitionService.updateYearRepartition(id, data));
  ipcMain.handle("yearRepartition:delete", async (_, id) => global.yearRepartitionService.deleteYearRepartition(id));
  ipcMain.handle("yearRepartition:setCurrent", async (_, id) => global.yearRepartitionService.setCurrentYearRepartition(id));
  
  // --- Bourses ---
  ipcMain.handle("scholarship:getByStudent", async (_, studentId) => global.scholarshipService.getByStudent(studentId));
  ipcMain.handle("scholarship:getActiveByStudent", async (_, studentId) => global.paymentService.getActiveByStudent(studentId));

  // --- Licence ---
  ipcMain.handle("license:generateMachineId", async () => ({ success: true, data: global.licenseService.generateMachineId() }));
  ipcMain.handle("license:activate", async (_, licenseCode) => global.licenseService.activateLicense(licenseCode));
  ipcMain.handle("license:isValid", async () => ({ success: true, data: await global.licenseService.getLicenseStatus() }));
  
  console.log('Tous les handlers IPC ont été enregistrés.');
}