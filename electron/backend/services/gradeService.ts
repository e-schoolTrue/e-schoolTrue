import {Repository} from "typeorm";
import {BranchEntity, ClassRoomEntity, GradeEntity} from "#electron/backend/entities/grade.ts";
import {AppDataSource} from "#electron/data-source.ts";
import {messages} from "#app/messages.ts";
import {
    IGradeServiceResponse,
    GradeCommand,
    BranchCommand,
    ClassRoomCommand,
    IClassRoomData} from "../../../src/types/grade";

export class GradeService {
    private gradeRepository: Repository<GradeEntity>;
    private classRoomRepository: Repository<ClassRoomEntity>;
    private branchRepository: Repository<BranchEntity>;

    constructor() {
        this.classRoomRepository = AppDataSource.getInstance().getRepository(ClassRoomEntity);
        this.gradeRepository = AppDataSource.getInstance().getRepository(GradeEntity);
        this.branchRepository = AppDataSource.getInstance().getRepository(BranchEntity);
    }

    async newGrade(command: GradeCommand): Promise<IGradeServiceResponse> {
        try {
            if (!command.name || !command.code) {
                return {
                    success: false,
                    message: "Le nom et le code sont requis",
                    data: null,
                    error: "Missing required fields"
                };
            }

            const newGrade = new GradeEntity();
            newGrade.name = command.name;
            newGrade.code = command.code;
            await this.gradeRepository.save(newGrade);
            const grades = await this.gradeRepository.find();
            return {
                success: true,
                message: messages.grade_save_successfully,
                data: grades,
                error: null
            };
        } catch (e: any) {
            return {
                success: false,
                message: messages.grade_save_failed,
                data: null,
                error: e.message
            };
        }
    }

    async getGrades(): Promise<IGradeServiceResponse> {
        try {
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {
                success: true,
                message: "",
                data: grades,
                error: null
            };
        } catch (e: any) {
            return {
                success: false,
                message: messages.grade_retieve_failed,
                data: null,
                error: e.message
            };
        }
    }

    async updateGrade(command: GradeCommand): Promise<IGradeServiceResponse> {
        try {
            if (!command.id || !command.name || !command.code) {
                return {
                    success: false,
                    message: "L'ID, le nom et le code sont requis",
                    data: null,
                    error: "Missing required fields"
                };
            }

            const grade = await this.gradeRepository.findOneBy({id: command.id});
            if (!grade) {
                return {
                    success: false,
                    message: messages.grade_not_found,
                    data: null,
                    error: null
                };
            }

            grade.name = command.name;
            grade.code = command.code;
            await this.gradeRepository.save(grade);
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {
                success: true,
                message: messages.grade_update_successfully,
                data: grades,
                error: null
            };
        } catch (e: any) {
            return {
                success: false,
                message: messages.grade_update_failed,
                data: null,
                error: e.message
            };
        }
    }

    async deleteGrade(id: number): Promise<IGradeServiceResponse> {
        try {
            const grade = await this.gradeRepository.findOneBy({id: id});
            if (!grade) {
                return {
                    success: false,
                    message: messages.grade_not_found,
                    data: null,
                    error: null
                };
            }
            await this.gradeRepository.delete(id);
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {
                success: true,
                message: messages.grade_delete_successfully,
                data: grades,
                error: null
            };
        } catch (e: any) {
            return {
                success: false,
                message: messages.grade_delete_failed,
                data: null,
                error: e.message
            };
        }
    }

    async newClassRoom(command: ClassRoomCommand): Promise<IGradeServiceResponse> {
        try {
            if (!command.name || !command.code || !command.capacity || !command.gradeId) {                return {
                    success: false,
                    message: "Tous les champs sont requis",
                    error: "Missing required fields",
                    data: null
                };
            }

            const grade = await this.gradeRepository.findOne({ where: { id: command.gradeId } });
            if (!grade) {                return {
                    success: false,
                    message: "Niveau non trouvé",
                    error: "Grade not found",
                    data: null
                };
            }

            const classRoom = new ClassRoomEntity();
            classRoom.name = command.name;
            classRoom.code = command.code;
            classRoom.capacity = command.capacity;            classRoom.grade = grade;            
            // Save the new classroom
            await this.classRoomRepository.save(classRoom);
            
            // Récupérer toutes les salles après création
            const classRooms = await this.classRoomRepository.find({
                relations: {
                    branch: true,
                    grade: true
                }
            });
            
            return {
                success: true,
                data: classRooms as IClassRoomData[],
                message: "Salle de classe créée avec succès",
                error: null
            };
        } catch (error) {
            return {                success: false,
                message: "Erreur lors de la création de la salle de classe",
                error: error instanceof Error ? error.message : "Unknown error",
                data: null
            };
        }
    }

    async updateClassRoom(command: ClassRoomCommand): Promise<IGradeServiceResponse> {
        try {
            if (!command.id || !command.name || !command.code || !command.capacity) {
                return {
                    success: false,
                    message: "L'ID, le nom, le code et la capacité sont requis",
                    data: null,
                    error: "Missing required fields"
                };
            }

            const classRoom = await this.classRoomRepository.findOneBy({id: command.id});
            if (!classRoom) {
                return {
                    success: false,
                    message: messages.class_room_not_found,
                    data: null,
                    error: null
                };
            }

            classRoom.name = command.name;
            classRoom.code = command.code;
            classRoom.capacity = command.capacity;
            if (command.gradeId) {
                classRoom.grade = {id: command.gradeId} as GradeEntity;
            }
            if (command.branchId) {
                classRoom.branch = {id: command.branchId} as BranchEntity;
            }            await this.classRoomRepository.save(classRoom);
            const classRooms = await this.classRoomRepository.find({
                relations: {
                    branch: true,
                    grade: true
                }
            });
            return {
                success: true,
                message: messages.class_room_update_successfully,
                data: classRooms as IClassRoomData[],
                error: null
            };
        } catch (e: any) {
            return {
                success: false,
                message: messages.class_room_update_failed,
                data: null,
                error: e.message
            };
        }
    }

    async deleteClassRoom(id: number): Promise<IGradeServiceResponse> {
        try {
            const classRoom = await this.classRoomRepository.findOneBy({id: id});
            if (!classRoom) {
                return {
                    success: false,
                    message: messages.class_room_not_found,
                    data: null,
                    error: null
                };
            }
            await this.classRoomRepository.delete(id);            const classRooms = await this.classRoomRepository.find({
                relations: {
                    branch: true,
                    grade: true
                }
            });
            return {
                success: true,
                message: messages.class_room_delete_successfully,
                data: classRooms as IClassRoomData[],
                error: null
            };
        } catch (e: any) {
            return {
                success: false,
                message: messages.class_room_delete_failed,
                data: null,
                error: e.message
            };
        }
    }

    async getClassRooms(): Promise<IGradeServiceResponse> {
        try {
            const classRooms = await this.classRoomRepository.find({
                relations: {
                    branch: true,
                    grade: true
                }
            });
            return {                success: true,
                message: "",
                data: classRooms as IClassRoomData[],
                error: null
            };
        } catch (e: any) {
            return {
                success: false,
                message: messages.class_room_retieve_failed,
                data: null,
                error: e.message
            };
        }
    }

    async newBranch(command: BranchCommand): Promise<IGradeServiceResponse> {
        try {
            if (!command.name || !command.code || !command.gradeId) {
                return {
                    success: false,
                    message: "Le nom, le code et l'ID de la classe sont requis",
                    data: null,
                    error: "Missing required fields"
                };
            }

            const newBranch = new BranchEntity();
            newBranch.name = command.name;
            newBranch.code = command.code;
            newBranch.grade = {id: command.gradeId} as GradeEntity;
            await this.branchRepository.save(newBranch);
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {
                success: true,
                message: messages.branch_save_successfully,
                data: grades,
                error: null
            };
        } catch (e: any) {
            return {
                success: false,
                message: messages.branch_save_failed,
                data: null,
                error: e.message
            };
        }
    }

    async deleteBranch(id: number): Promise<IGradeServiceResponse> {
        try {
            const branch = await this.branchRepository.findOneBy({id: id});
            if (!branch) {
                return {
                    success: false,
                    message: messages.branch_not_found,
                    data: null,
                    error: null
                };
            }
            await this.branchRepository.delete(id);
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {
                success: true,
                message: messages.branch_delete_successfully,
                data: grades,
                error: null
            };
        } catch (e: any) {
            return {
                success: false,
                message: messages.branch_delete_failed,
                data: null,
                error: e.message
            };
        }
    }

    async updateBranch(command: BranchCommand): Promise<IGradeServiceResponse> {
        try {
            if (!command.id || !command.name || !command.code || !command.gradeId) {
                return {
                    success: false,
                    message: "L'ID, le nom, le code et l'ID de la classe sont requis",
                    data: null,
                    error: "Missing required fields"
                };
            }

            const branch = await this.branchRepository.findOneBy({id: command.id});
            if (!branch) {
                return {
                    success: false,
                    message: messages.branch_not_found,
                    data: null,
                    error: null
                };
            }

            branch.name = command.name;
            branch.code = command.code;
            branch.grade = {id: command.gradeId} as GradeEntity;
            await this.branchRepository.save(branch);
            const grades = await this.gradeRepository.find({
                relations: {
                    branches: true
                }
            });
            return {
                success: true,
                message: messages.branch_update_successfully,
                data: grades,
                error: null
            };
        } catch (e: any) {
            return {
                success: false,
                message: messages.branch_update_failed,
                data: null,
                error: e.message
            };
        }
    }

    async getTotalClasses(): Promise<IGradeServiceResponse> {
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