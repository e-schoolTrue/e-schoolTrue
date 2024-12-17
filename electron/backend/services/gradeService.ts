import {Repository} from "typeorm";
import {BranchEntity, ClassRoomEntity, GradeEntity} from "#electron/backend/entities/grade.ts";
import {AppDataSource} from "#electron/data-source.ts";
import {ResultType} from "#electron/command";
import {messages} from "#app/messages.ts";
import {BranchCommand, ClassRoomCommand, GradeCommand} from "#electron/command/settingsCommand.ts";


export class GradeService {
    private gradeRepository: Repository<GradeEntity>;
    private classRoomRepository: Repository<ClassRoomEntity>;
    private branchRepository: Repository<BranchEntity>

    constructor() {
        this.classRoomRepository = AppDataSource.getInstance().getRepository(ClassRoomEntity);
        this.gradeRepository = AppDataSource.getInstance().getRepository(GradeEntity);
        this.branchRepository = AppDataSource.getInstance().getRepository(BranchEntity);
    }

    async newGrade(command:GradeCommand): Promise<ResultType> {
        try{
            const newGrade = new GradeEntity();
            newGrade.name = command.name;
            newGrade.code = command.code;
            await this.gradeRepository.save(newGrade);
            const grades = await this.gradeRepository.find()
            return {success: true, message: messages.grade_save_successfully, data: grades, error: null};
        }catch (e) {
            return {success: false, message: messages.grade_save_failed, data: null, error: e};
        }
    }

    async getGrades(): Promise<ResultType> {
        try {
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {success: true, message: null, data: grades, error: null};
        } catch (e) {
            return {success: false, message: messages.grade_retieve_failed, data: null, error: e};
        }
    }

    async updateGrade(command: GradeCommand): Promise<ResultType> {
        try {
            const grade = await this.gradeRepository.findBy({id: command.id});
            if (!grade) {
                return {success: false, message: messages.grade_not_found, data: null, error: null};
            }
            grade[0].name = command.name;
            grade[0].code = command.code;
            await this.gradeRepository.save(grade);
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {success: true, message: messages.grade_update_successfully, data: grades, error: null};
        } catch (e) {
            return {success: false, message: messages.grade_update_failed, data: null, error: e};
        }
    }

    async deleteGrade(id: number): Promise<ResultType> {
        try {
            const grade = await this.gradeRepository.findBy({id:id});
            if (!grade) {
                return {success: false, message: messages.grade_not_found, data: null, error: null};
            }
            await this.gradeRepository.delete(id);
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {success: true, message: messages.grade_delete_successfully, data: grades, error: null};
        } catch (e) {
            return {success: false, message: messages.grade_delete_failed, data: null, error: e};
        }
    }

    async newClassRoom(command:ClassRoomCommand): Promise<ResultType> {
        try{
            const newClassRoom = new ClassRoomEntity();
            newClassRoom.name = command.name;
            newClassRoom.code = command.code;
            newClassRoom.capacity = command.capacity;
            await this.classRoomRepository.save(command);
            const classRooms = await this.classRoomRepository.find({
                relations:{
                    grade:true,
                    branch:true
                }
            })
            return {success: true, message: messages.class_room_save_successfully, data: classRooms, error: null};
        }catch (e) {
            return {success: false, message: messages.class_room_save_failed, data: null, error: e};
        }
    }

    async updateClassRoom(command: ClassRoomCommand): Promise<ResultType> {
        try {
            const classRoom = await this.classRoomRepository.findBy({id: command.id});
            if (!classRoom) {
                return {success: false, message: messages.grade_not_found, data: null, error: null};
            }
            classRoom[0].name = command.name;
            classRoom[0].code = command.code;
            classRoom[0].capacity = command.capacity;
            await this.classRoomRepository.save(classRoom);
            const classRooms = await this.classRoomRepository.find({
                relations: {
                    branch: true,
                    grade: true
                }
            });
            return {success: true, message: messages.class_room_update_successfully, data: classRooms, error: null};
        } catch (e) {
            return {success: false, message: messages.class_room_update_failed, data: null, error: e};
        }
    }
    async deleteClassRoom(id: number): Promise<ResultType> {
        try {
            const classRoom = await this.classRoomRepository.findBy({id:id});
            if (!classRoom) {
                return {success: false, message: messages.class_room_not_found, data: null, error: null};
            }
            await this.classRoomRepository.delete(id);
            const classRooms = await this.classRoomRepository.find({
                relations: {
                    branch: true,
                    grade: true
                }
            });
            return {success: true, message: messages.class_room_delete_successfully, data: classRooms, error: null};
        } catch (e) {
            return {success: false, message: messages.class_room_delete_failed, data: null, error: e};
        }
    }

    async getClassRooms(): Promise<ResultType> {
        try {
            const classRooms = await this.classRoomRepository.find({
                relations: {
                    branch: true,
                    grade: true
                }
            });
            return {success: true, message: null, data: classRooms, error: null};
        } catch (e) {
            return {success: false, message: messages.class_room_retieve_failed, data: null, error: e};
        }
    }

    async newBranch(command:BranchCommand): Promise<ResultType> {
        try{
            const newBranch = new BranchEntity();
            newBranch.name = command.name;
            newBranch.code = command.code;
            newBranch.grade = command.grade
            await this.branchRepository.save(newBranch);
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {success: true, message: messages.branch_save_successfully, data: grades, error: null};
        }catch (e) {
            return {success: false, message: messages.branch_save_failed, data: null, error: e};
        }
    }

    async deleteBranch(id: number): Promise<ResultType> {
        try {
            const grade = await this.branchRepository.findBy({id:id});
            if (!grade) {
                return {success: false, message: messages.branch_not_found, data: null, error: null};
            }
            await this.branchRepository.delete(id);
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {success: true, message: messages.branch_delete_successfully, data: grades, error: null};
        } catch (e) {
            return {success: false, message: messages.branch_delete_failed, data: null, error: e};
        }
    }

    async updateBranch(command: BranchCommand): Promise<ResultType> {
        try {
            const branch = await this.branchRepository.findBy({id: command.id});
            if (!branch) {
                return {success: false, message: messages.grade_not_found, data: null, error: null};
            }
            branch[0].name = command.name;
            branch[0].code = command.code;
            await this.branchRepository.save(branch);
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {success: true, message: messages.branch_update_successfully, data: grades, error: null};
        } catch (e) {
            return {success: false, message: messages.branch_update_failed, data: null, error: e};
        }
    }

    async getTotalClasses(): Promise<ResultType> {
        try {
            const count = await this.gradeRepository.count();
            return {
                success: true,
                data: count,
                message: "Nombre total de classes récupéré avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération du nombre de classes",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

}