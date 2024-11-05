import {ResultType} from "@electron/command";
import {ProfessorCommand} from "@electron/command/professorCommand.ts";
import {AppDataSource} from "@electron/data-source.ts";
import {EntityManager} from "typeorm";
import {ProfessorMapper} from "@electron/mappers/professorMapper.ts";
import {ProfessorEntity} from "@electron/entities/professor.ts";
import {FileEntity} from "@electron/entities/file.ts";


export class ProfessorService{
    async saveProfessor(command:ProfessorCommand):Promise<ResultType>{
        try{
            return await AppDataSource.getInstance().transaction(async(entityManager:EntityManager)=>{
                const professorResult = await entityManager.save(ProfessorMapper.professorCommand_To_professorEntity(command))
                await Promise.all(command.qualifications?.map(async(quandlification)=> {
                    const qualificationEntity = ProfessorMapper.qualificationCommand_To_qualificationEntity(quandlification)
                    const attachement = await entityManager.find<FileEntity>(FileEntity , {where:{id:quandlification.attachement_id}})
                    qualificationEntity.professor = professorResult
                    qualificationEntity.attachement = attachement[0]
                    await entityManager.save(qualificationEntity)
                }))
                const allProfessor = await entityManager.find<ProfessorEntity>(ProfessorEntity)
                const professorResponse = allProfessor?.map((professor)=>ProfessorMapper.professorEntity_To_professorResponse(professor))
                return {success:true , erro:null , data:professorResponse , message:""}
            })
        }catch (e:any) {
            return {success:false , error:e.message , data:null , message:""}
        }
    }
}