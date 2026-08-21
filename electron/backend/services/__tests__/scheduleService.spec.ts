import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp') },
}));

vi.mock('#electron/data-source', () => ({
  AppDataSource: {
    getInstance: vi.fn(),
    initialize: vi.fn(),
  },
}));
vi.mock('../../data-source', () => ({
  AppDataSource: {
    getInstance: vi.fn(),
    initialize: vi.fn(),
  },
}));
vi.mock('../../../data-source', () => ({
  AppDataSource: {
    getInstance: vi.fn(),
    initialize: vi.fn(),
  },
}));
vi.mock('#electron/messages', () => ({
  messages: {
    schedule_save_successfully: 'Emploi du temps créé avec succès',
    schedule_save_failed: "Erreur lors de la création",
    schedule_update_successfully: 'Emploi du temps mis à jour avec succès',
    schedule_update_failed: 'Erreur mise à jour',
    schedule_delete_successfully: 'Créneau supprimé',
    schedule_delete_failed: 'Erreur suppression',
    schedule_retrieve_failed: 'Erreur récupération',
  },
}));
vi.mock('../../messages', () => ({
  messages: {
    schedule_save_successfully: 'Emploi du temps créé avec succès',
    schedule_save_failed: "Erreur lors de la création",
    schedule_update_successfully: 'Emploi du temps mis à jour avec succès',
    schedule_update_failed: 'Erreur mise à jour',
    schedule_delete_successfully: 'Créneau supprimé',
    schedule_delete_failed: 'Erreur suppression',
    schedule_retrieve_failed: 'Erreur récupération',
  },
}));
vi.mock('#electron/backend/entities/schedule', async () => {
  const actual: any = await vi.importActual('#electron/backend/entities/schedule');
  return actual;
});

import { ScheduleService } from '../scheduleService';
import { AppDataSource } from '#electron/data-source';

function makeGrade(id = 10, name = '6eme A', type: string = 'SECONDARY') {
  return { id, name, type };
}
function makeCourse(id = 5, name = 'Maths') {
  return { id, name };
}
function makeProfessor(overrides: any = {}) {
  return {
    id: 1,
    firstname: 'Jean',
    lastname: 'Dupont',
    civility: 'M.',
    teaching: [],
    ...overrides,
  };
}

describe('ScheduleService', () => {
  let service: ScheduleService;
  let mockScheduleRepo: any;
  let mockProfessorRepo: any;
  let mockGradeRepo: any;
  let mockCourseRepo: any;
  let dataSourceMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockScheduleRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(async (data: any) => ({ id: 1, ...data, createdAt: new Date(), updatedAt: new Date() })),
      remove: vi.fn().mockResolvedValue(undefined),
      createQueryBuilder: vi.fn(),
    };
    mockProfessorRepo = {
      findOne: vi.fn().mockResolvedValue(makeProfessor()),
    };
    mockGradeRepo = {
      findOne: vi.fn().mockResolvedValue(makeGrade()),
    };
    mockCourseRepo = {
      findOne: vi.fn().mockResolvedValue(makeCourse()),
    };

    dataSourceMock = {
      getRepository: vi.fn((entity: any) => {
        const name = entity?.name || '';
        if (name === 'ScheduleEntity') return mockScheduleRepo;
        if (name === 'ProfessorEntity') return mockProfessorRepo;
        if (name === 'GradeEntity') return mockGradeRepo;
        if (name === 'CourseEntity') return mockCourseRepo;
        // fallback based on string includes
        if (name.includes('Schedule')) return mockScheduleRepo;
        if (name.includes('Professor')) return mockProfessorRepo;
        if (name.includes('Grade')) return mockGradeRepo;
        if (name.includes('Course')) return mockCourseRepo;
        return mockScheduleRepo;
      }),
      isInitialized: true,
    };

    vi.mocked(AppDataSource.getInstance).mockReturnValue(dataSourceMock as any);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    service = new ScheduleService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. createSchedule SECONDARY requires courseId -> error if missing', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(10, '6eme', 'SECONDARY'));
    mockProfessorRepo.findOne.mockResolvedValue(makeProfessor({ teaching: [{ course: { id: 5 }, class: { id: 10 } }] }));
    const cmd: any = { professorId: 1, classId: 10, day: 'lundi', timeSlot: '08-09' }; // missing courseId
    const result = await service.createSchedule(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Course ID required for secondary school');
  });

  it('2. createSchedule PRIMARY requires teaching assignment (teachingId)', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(20, 'CP', 'PRIMARY'));
    const cmd: any = { professorId: 1, classId: 20, day: 'lundi', timeSlot: '08-09', courseId: undefined }; // missing teachingId
    const result = await service.createSchedule(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Teaching ID required for primary school');
  });

  it('3a. createSchedule validates professor teaching triple-check: class.id match', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(10, '6eme', 'SECONDARY'));
    mockProfessorRepo.findOne.mockResolvedValue(makeProfessor({
      teaching: [{ course: { id: 5 }, class: { id: 10 }, gradeIds: undefined, grades: [] }],
    }));
    mockCourseRepo.findOne.mockResolvedValue(makeCourse(5));
    mockScheduleRepo.findOne.mockResolvedValue(null); // no conflict, no existing class schedule
    const cmd: any = { professorId: 1, classId: 10, courseId: 5, day: 'lundi', timeSlot: '08-09', teachingId: 1 };
    const result = await service.createSchedule(cmd);
    expect(result.success).toBe(true);
  });

  it('3b. triple-check via gradeIds CSV', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(11, '5eme', 'SECONDARY'));
    mockProfessorRepo.findOne.mockResolvedValue(makeProfessor({
      teaching: [{ course: { id: 5 }, class: { id: 999 }, gradeIds: '10,11,12', grades: [] }],
    }));
    mockCourseRepo.findOne.mockResolvedValue(makeCourse(5));
    mockScheduleRepo.findOne.mockResolvedValue(null);
    const cmd: any = { professorId: 1, classId: 11, courseId: 5, day: 'mardi', timeSlot: '09-10', teachingId: 1 };
    const result = await service.createSchedule(cmd);
    expect(result.success).toBe(true);
  });

  it('3c. triple-check via grades M2M', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(12, '4eme', 'SECONDARY'));
    mockProfessorRepo.findOne.mockResolvedValue(makeProfessor({
      teaching: [{ course: { id: 5 }, class: undefined, gradeIds: undefined, grades: [{ id: 12 }, { id: 13 }] }],
    }));
    mockCourseRepo.findOne.mockResolvedValue(makeCourse(5));
    mockScheduleRepo.findOne.mockResolvedValue(null);
    const cmd: any = { professorId: 1, classId: 12, courseId: 5, day: 'mercredi', timeSlot: '10-11', teachingId: 1 };
    const result = await service.createSchedule(cmd);
    expect(result.success).toBe(true);
  });

  it('3d. triple-check failure when professor does not teach this course in this class', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(10, '6eme', 'SECONDARY'));
    mockProfessorRepo.findOne.mockResolvedValue(makeProfessor({
      teaching: [{ course: { id: 99 }, class: { id: 10 } }],
    }));
    mockCourseRepo.findOne.mockResolvedValue(makeCourse(5));
    const cmd: any = { professorId: 1, classId: 10, courseId: 5, day: 'lundi', timeSlot: '08-09', teachingId: 1 };
    const result = await service.createSchedule(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Professor does not teach this course in this class');
  });

  it('4. createSchedule conflict detection: same professor same day/timeSlot different class -> error', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(10, '6eme', 'SECONDARY'));
    mockCourseRepo.findOne.mockResolvedValue(makeCourse(5));
    mockProfessorRepo.findOne.mockResolvedValue(makeProfessor({
      firstname: 'Jean', lastname: 'Dupont', civility: 'M.',
      teaching: [{ course: { id: 5 }, class: { id: 10 } }],
    }));
    // First findOne is for professor conflict check
    mockScheduleRepo.findOne.mockImplementation(async (opts: any) => {
      if (opts?.where?.professorId === 1 && opts?.where?.day === 'lundi' && opts?.where?.timeSlot === '08-09') {
        // conflict with different class
        return { id: 99, classId: 999, professorId: 1, class: { name: '5eme B' } } as any;
      }
      if (opts?.where?.classId === 10) return null;
      return null;
    });
    const cmd: any = { professorId: 1, classId: 10, courseId: 5, day: 'lundi', timeSlot: '08-09', teachingId: 1 };
    const result = await service.createSchedule(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Schedule conflict detected');
    expect(result.message).toContain('Conflit détecté');
  });

  it('5. createSchedule upsert: same class same day/timeSlot -> replaces', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(10, '6eme', 'SECONDARY'));
    mockCourseRepo.findOne.mockResolvedValue(makeCourse(5));
    mockProfessorRepo.findOne.mockResolvedValue(makeProfessor({
      teaching: [{ course: { id: 5 }, class: { id: 10 } }],
    }));
    const existingClassSchedule = { id: 50, classId: 10, professorId: 2, courseId: 3, day: 'lundi', timeSlot: '08-09', updatedAt: new Date('2020-01-01') };
    mockScheduleRepo.findOne.mockImplementation(async (opts: any) => {
      // professor conflict check: same professor same slot but same classId so no conflict (or null)
      if (opts?.where?.professorId) {
        // return existing schedule with same classId => no conflict (should not error)
        // To avoid conflict, return null or return with same classId
        return null;
      }
      if (opts?.where?.classId === 10) {
        return existingClassSchedule as any;
      }
      return null;
    });
    mockScheduleRepo.save.mockImplementation(async (data: any) => ({ ...data, updatedAt: new Date() }));

    const cmd: any = { professorId: 1, classId: 10, courseId: 5, day: 'lundi', timeSlot: '08-09', teachingId: 1 };
    const result = await service.createSchedule(cmd);
    expect(result.success).toBe(true);
    expect(mockScheduleRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 50, professorId: 1, courseId: 5 }));
    expect(result.message).toContain('mis à jour');
  });

  it('6. getScheduleByDate parses YYYY-MM-DD correctly and returns day name (2026-08-20 -> jeudi, 2026-08-21 -> vendredi)', async () => {
    // Verify correct day parsing: 2026-08-20 is Thursday (jeudi), 2026-08-21 is Friday (vendredi)
    // Service uses new Date(year, month-1, day) and dayNames = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']
    mockScheduleRepo.find.mockResolvedValue([{ id: 1, day: 'jeudi', timeSlot: '08-09', professor: { firstname: 'A', lastname: 'B', civility: 'M.' }, course: { id: 5, name: 'Maths' }, class: { id: 10, name: '6eme' } } as any]);

    const resultJeudi = await service.getScheduleByDate('2026-08-20');
    expect(resultJeudi.success).toBe(true);
    expect(mockScheduleRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { day: 'jeudi' } }));

    mockScheduleRepo.find.mockClear();
    mockScheduleRepo.find.mockResolvedValue([{ id: 2, day: 'vendredi', timeSlot: '08-09', professor: { firstname: 'C', lastname: 'D', civility: 'M.' }, course: { id: 5, name: 'Maths' }, class: { id: 10, name: '6eme' } } as any]);
    const resultVendredi = await service.getScheduleByDate('2026-08-21');
    expect(resultVendredi.success).toBe(true);
    expect(mockScheduleRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { day: 'vendredi' } }));
    expect(Array.isArray(resultVendredi.data)).toBe(true);
  });

  it('7. getScheduleByDate parses other dates correctly (2026-08-17 -> lundi)', async () => {
    mockScheduleRepo.find.mockResolvedValue([]);
    await service.getScheduleByDate('2026-08-17'); // Monday
    expect(mockScheduleRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { day: 'lundi' } }));
  });

  it('8. checkConflicts logic true and false', async () => {
    // hasConflict true
    const qbMockTrue: any = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({ id: 1, professorId: 1, day: 'lundi', timeSlot: '08-09', class: { name: '6eme' } }),
    };
    mockScheduleRepo.createQueryBuilder.mockReturnValue(qbMockTrue);
    const resTrue = await service.checkConflicts(1, 'lundi', '08-09');
    expect(resTrue.hasConflict).toBe(true);
    expect(resTrue.conflictDetails).toBeDefined();

    // hasConflict false
    const qbMockFalse: any = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(null),
    };
    mockScheduleRepo.createQueryBuilder.mockReturnValue(qbMockFalse);
    const resFalse = await service.checkConflicts(1, 'mardi', '09-10');
    expect(resFalse.hasConflict).toBe(false);
  });

  it('9. checkConflicts with excludeScheduleId adds andWhere clause', async () => {
    const qbMock: any = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(null),
    };
    mockScheduleRepo.createQueryBuilder.mockReturnValue(qbMock);
    await service.checkConflicts(1, 'lundi', '08-09', 99);
    expect(qbMock.andWhere).toHaveBeenCalledWith('schedule.id != :excludeScheduleId', { excludeScheduleId: 99 });
  });

  it('10. Validation for invalid day enum and timeSlot regex - missing required fields guard', async () => {
    // Missing professorId
    const resMissing = await service.createSchedule({ classId: 10, day: 'lundi', timeSlot: '08-09' } as any);
    expect(resMissing.success).toBe(false);
    expect(resMissing.error).toBe('Missing required fields');

    // Missing day
    const resMissingDay = await service.createSchedule({ professorId: 1, classId: 10, timeSlot: '08-09' } as any);
    expect(resMissingDay.success).toBe(false);

    // Missing timeSlot
    const resMissingSlot = await service.createSchedule({ professorId: 1, classId: 10, day: 'lundi' } as any);
    expect(resMissingSlot.success).toBe(false);

    // Invalid day value still passes missing check but would be stored; we verify service does not crash and proceeds to class lookup
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(10, '6eme', 'SECONDARY'));
    mockCourseRepo.findOne.mockResolvedValue(makeCourse(5));
    mockProfessorRepo.findOne.mockResolvedValue(makeProfessor({ teaching: [{ course: { id: 5 }, class: { id: 10 } }] }));
    mockScheduleRepo.findOne.mockResolvedValue(null);
    const resInvalidDay = await service.createSchedule({ professorId: 1, classId: 10, courseId: 5, day: 'Funday' as any, timeSlot: 'invalid' } as any);
    // Should still succeed (no enum validation in current code), demonstrating lack of strict validation - but we test it doesn't throw
    expect(resInvalidDay.success).toBe(true);
  });

  it('11. Test ensureRepositoriesInitialized guard - handles repository throwing', async () => {
    // Simulate repository failure inside createSchedule (e.g., DB not initialized)
    // Service constructor already succeeded with valid mock, now make grade lookup throw
    mockGradeRepo.findOne.mockRejectedValue(new Error('DB not initialized'));
    const result = await service.createSchedule({ professorId: 1, classId: 10, courseId: 5, day: 'lundi', timeSlot: '08-09', teachingId: 1 } as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('DB not initialized');

    // Also verify that fresh service construction fails gracefully when AppDataSource.getInstance throws
    vi.mocked(AppDataSource.getInstance).mockImplementation(() => { throw new Error('AppDataSource not initialized'); });
    expect(() => new ScheduleService()).toThrow('AppDataSource not initialized');
    // Restore for subsequent tests
    vi.mocked(AppDataSource.getInstance).mockReturnValue(dataSourceMock as any);
  });

  it('12. Validation for timeSlot regex - ensures service handles malformed timeSlot without crashing', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(10, '6eme', 'SECONDARY'));
    mockCourseRepo.findOne.mockResolvedValue(makeCourse(5));
    mockProfessorRepo.findOne.mockResolvedValue(makeProfessor({ teaching: [{ course: { id: 5 }, class: { id: 10 } }] }));
    mockScheduleRepo.findOne.mockResolvedValue(null);
    // malformed timeSlot like "abc", still should not throw
    const result = await service.createSchedule({ professorId: 1, classId: 10, courseId: 5, day: 'lundi', timeSlot: 'abc' } as any);
    expect(result.success).toBe(true);
    expect(mockScheduleRepo.save).toHaveBeenCalledWith(expect.objectContaining({ timeSlot: 'abc' }));
  });

  it('13. createSchedule handles professor not found', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(10, '6eme', 'SECONDARY'));
    mockProfessorRepo.findOne.mockResolvedValue(null);
    const result = await service.createSchedule({ professorId: 999, classId: 10, courseId: 5, day: 'lundi', timeSlot: '08-09', teachingId: 1 } as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Professor not found');
  });

  it('14. createSchedule handles class not found', async () => {
    mockGradeRepo.findOne.mockResolvedValue(null);
    const result = await service.createSchedule({ professorId: 1, classId: 999, courseId: 5, day: 'lundi', timeSlot: '08-09', teachingId: 1 } as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Class not found');
  });

  it('15. createSchedule handles course not found for SECONDARY', async () => {
    mockGradeRepo.findOne.mockResolvedValue(makeGrade(10, '6eme', 'SECONDARY'));
    mockCourseRepo.findOne.mockResolvedValue(null);
    mockProfessorRepo.findOne.mockResolvedValue(makeProfessor({ teaching: [{ course: { id: 5 }, class: { id: 10 } }] }));
    const result = await service.createSchedule({ professorId: 1, classId: 10, courseId: 999, day: 'lundi', timeSlot: '08-09', teachingId: 1 } as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Course not found');
  });

  it('16. course color logic not needed - mapEntityToData handles missing color gracefully', async () => {
    const entity: any = {
      id: 1,
      professorId: 1,
      courseId: 5,
      classId: 10,
      day: 'lundi',
      timeSlot: '08-09',
      createdAt: new Date(),
      updatedAt: new Date(),
      professor: { id: 1, firstname: 'Jean', lastname: 'Dupont', civility: 'M.', qualification: null, photo: null },
      course: { id: 5, name: 'Maths' },
      class: { id: 10, name: '6eme' },
    };
    // Access private method
    const mapped = (service as any).mapEntityToData(entity);
    expect(mapped.professor.color).toBeNull();
    expect(mapped.course.name).toBe('Maths');
  });
});
