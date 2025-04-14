import {Repository} from "typeorm";
import {CourseEntity} from "#electron/backend/entities/course.ts";
import {AppDataSource} from "#electron/data-source.ts";
import {Mapper} from "#electron/command";
import {messages} from "#app/messages.ts";
import {
    ICourseServiceParams,
    ICourseServiceResponse
} from "../types/course";

export class CourseService {
    private courseRepository: Repository<CourseEntity>;

    constructor() {
        this.courseRepository = AppDataSource.getInstance().getRepository(CourseEntity);
    }

    async newCourse(command: ICourseServiceParams['newCourse']): Promise<ICourseServiceResponse> {
        try {
            const newCourse = new CourseEntity();
            newCourse.name = command.name;
            newCourse.coefficient = command.coefficient;
            newCourse.code = command.code;
            await this.courseRepository.save(newCourse);
            const allCourse = await this.courseRepository.find({
                relations: {
                    courses: true,
                    observations: true
                }
            });
            return {success: true, data: allCourse, error: null, message: messages.course_save_successfully};
        } catch (e: any) {
            return {success: true, data: null, error: e.message, message: messages.course_save_failed};
        }
    }

    async addCourseToGroupement(command: ICourseServiceParams['addCourseToGroupement']): Promise<ICourseServiceResponse> {
        try {
            const newCourse = Mapper.mapTo<ICourseServiceParams['addCourseToGroupement'], CourseEntity>(command, CourseEntity);
            await this.courseRepository.save(newCourse);
            const course = await this.courseRepository.find({
                relations: {
                    courses: true,
                    observations: true,
                    groupement: true
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
            const oldCourse = await this.courseRepository.find({
                where: {
                    id: command.id
                }
            });
            oldCourse[0].code = command.data.code;
            oldCourse[0].coefficient = command.data.coefficient;
            oldCourse[0].name = command.data.name;
            await this.courseRepository.save(oldCourse);
            const allCourse = await this.courseRepository.find({
                relations: {
                    courses: true,
                    observations: true,
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
                    observations: true
                }
            });
            return {success: true, data: allCourse, error: null, message: ""};
        } catch (e: any) {
            console.log(e);
            return {success: false, data: null, error: e.message, message: messages.course_retrieve_failed};
        }
    }
}
