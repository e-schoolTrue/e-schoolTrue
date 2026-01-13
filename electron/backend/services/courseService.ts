import {Repository, In} from "typeorm";
import {CourseEntity} from "#electron/backend/entities/course";
import {GradeEntity} from "#electron/backend/entities/grade";
import {AppDataSource} from "#electron/data-source";
import {Mapper} from "#electron/command";
import {messages} from "#electron/messages";
import {
    ICourseServiceParams,
    ICourseServiceResponse
} from "../types/course";

export class CourseService {
    private courseRepository: Repository<CourseEntity>;
    private gradeRepository: Repository<GradeEntity>;

    constructor() {
        this.courseRepository = AppDataSource.getInstance().getRepository(CourseEntity);
        this.gradeRepository = AppDataSource.getInstance().getRepository(GradeEntity);
    }

    async newCourse(command: ICourseServiceParams['newCourse']): Promise<ICourseServiceResponse> {
        try {
            const newCourse = new CourseEntity();
            newCourse.name = command.name;
            newCourse.coefficient = command.coefficient;
            newCourse.code = command.code;
            
            // Associer les classes si fournies (nouvelle méthode avec gradeIds)
            if (command.gradeIds && Array.isArray(command.gradeIds) && command.gradeIds.length > 0) {
                const gradesEntities = await this.gradeRepository.findBy({ 
                    id: In(command.gradeIds) 
                });
                newCourse.grades = gradesEntities;
            }
            // Support pour l'ancienne méthode (un seul gradeId) pour rétrocompatibilité
            else if (command.gradeId) {
                const grade = await this.gradeRepository.findOne({ where: { id: command.gradeId } });
                if (grade) {
                    newCourse.grades = [grade];
                    newCourse.grade = grade; // Pour compatibilité
                }
            }
            
            await this.courseRepository.save(newCourse);
            const allCourse = await this.courseRepository.find({
                relations: {
                    courses: true,
                    observations: true,
                    grades: true,
                    grade: true
                }
            });
            return {success: true, data: allCourse, error: null, message: messages.course_save_successfully};
        } catch (e: any) {
            return {success: false, data: null, error: e.message, message: messages.course_save_failed};
        }
    }

    async addCourseToGroupement(command: ICourseServiceParams['addCourseToGroupement']): Promise<ICourseServiceResponse> {
        try {
            const newCourse = Mapper.mapTo<ICourseServiceParams['addCourseToGroupement'], CourseEntity>(command, CourseEntity);
            
            // Associer la classe si fournie
            if (command.gradeId) {
                const grade = await this.gradeRepository.findOne({ where: { id: command.gradeId } });
                if (grade) {
                    newCourse.grade = grade;
                }
            }
            
            await this.courseRepository.save(newCourse);
            const course = await this.courseRepository.find({
                relations: {
                    courses: true,
                    observations: true,
                    groupement: true,
                    grade: true
                }
            });
            return {success: true, data: course, error: null, message: messages.course_group_save_successfully};
        } catch (e: any) {
            return {success: true, data: null, error: e.message, message: messages.course_group_save_failed};
        }
    }

    async deleteCourse(id: number): Promise<ICourseServiceResponse> {
        try {
            await this.courseRepository.delete(id);
            const allCourse = await this.courseRepository.find({
                relations: {
                    courses: true,
                    observations: true
                }
            });
            return {success: true, data: allCourse, error: null, message: messages.course_delete_successfully};
        } catch (e: any) {
            return {success: true, data: null, error: e.message, message: messages.course_delete_failed};
        }
    }

    async updateCourse(command: ICourseServiceParams['updateCourse']): Promise<ICourseServiceResponse> {
        try {
            const oldCourse = await this.courseRepository.findOne({
                where: { id: command.id },
                relations: ['grades']
            });
            
            if (!oldCourse) {
                return {success: false, data: null, error: 'Course not found', message: messages.course_update_failed};
            }
            
            oldCourse.code = command.data.code;
            oldCourse.coefficient = command.data.coefficient;
            oldCourse.name = command.data.name;
            
            // Mettre à jour les classes (nouvelle méthode avec gradeIds)
            if (command.data.gradeIds && Array.isArray(command.data.gradeIds)) {
                const gradesEntities = await this.gradeRepository.findBy({ 
                    id: In(command.data.gradeIds) 
                });
                oldCourse.grades = gradesEntities;
            }
            // Support pour l'ancienne méthode (un seul gradeId)
            else if (command.data.gradeId) {
                const grade = await this.gradeRepository.findOne({ where: { id: command.data.gradeId } });
                if (grade) {
                    oldCourse.grades = [grade];
                    oldCourse.grade = grade;
                }
            }
            
            await this.courseRepository.save(oldCourse);
            const allCourse = await this.courseRepository.find({
                relations: {
                    courses: true,
                    observations: true,
                    grades: true,
                    grade: true
                }
            });
            return {success: true, data: allCourse, error: null, message: messages.course_update_successfully};
        } catch (e: any) {
            return {success: false, data: null, error: e.message, message: messages.course_update_failed};
        }
    }

    async getAllCourse(): Promise<ICourseServiceResponse> {
        try {
            const allCourse = await this.courseRepository.find({
                relations: {
                    courses: true,
                    observations: true,
                    grades: true,
                    grade: true
                }
            });
            return {success: true, data: allCourse, error: null, message: ""};
        } catch (e: any) {
            console.log(e);
            return {success: false, data: null, error: e.message, message: messages.course_retrieve_failed};
        }
    }

    async getCoursesByGrade(gradeId: number): Promise<ICourseServiceResponse> {
        try {
            // Récupérer les cours qui sont associés à cette classe (via la relation ManyToMany)
            const coursesWithGrade = await this.courseRepository
                .createQueryBuilder('course')
                .leftJoinAndSelect('course.grades', 'grades')
                .leftJoinAndSelect('course.grade', 'grade')
                .leftJoinAndSelect('course.courses', 'courses')
                .leftJoinAndSelect('course.observations', 'observations')
                .where('grades.id = :gradeId OR grade.id = :gradeId', { gradeId })
                .getMany();
                
            return {success: true, data: coursesWithGrade, error: null, message: ""};
        } catch (e: any) {
            console.log(e);
            return {success: false, data: null, error: e.message, message: messages.course_retrieve_failed};
        }
    }
}
