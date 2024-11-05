import {ProfessorCommand, QualificationCommand} from "@electron/command/professorCommand.ts";
import {ProfessorEntity, QualificationEntity} from "@electron/entities/professor.ts";
import {ProfessorResponse, QualificationResponse} from "@electron/response/professorResponse.ts";


export class ProfessorMapper{
    static professorCommand_To_professorEntity(command:ProfessorCommand):ProfessorEntity{
        const professorEntity = new ProfessorEntity()
        professorEntity.id = command.id
        professorEntity.address = command.address
        professorEntity.phone_number = command.phone_number
        professorEntity.birth_country = command.birth_country
        professorEntity.birth_town = command.birth_town
        professorEntity.cni_number = command.cni_number
        professorEntity.civility = command.civility
        professorEntity.firstname = command.firstname
        professorEntity.lastname = command.lastname
        professorEntity.birth_date = command.birth_date
        professorEntity.family_situation = command.family_situation
        professorEntity.town = command.town
        return professorEntity
    }
    static qualificationCommand_To_qualificationEntity(command:QualificationCommand):QualificationEntity{
        const qualificationEntity = new QualificationEntity()
        qualificationEntity.id = command.id
        qualificationEntity.name = command.name
        return qualificationEntity
    }

    static professorEntity_To_professorResponse(entity:ProfessorEntity):ProfessorResponse{
        const professorResponse = new ProfessorResponse()
        professorResponse.id = entity.id
        professorResponse.address = entity.address
        professorResponse.town = entity.town
        professorResponse.phone_number = entity.phone_number
        professorResponse.birth_country = entity.birth_country
        professorResponse.birth_town = entity.birth_town
        professorResponse.birth_date = entity.birth_date
        professorResponse.cni_number = entity.cni_number
        professorResponse.civility = entity.civility
        professorResponse.firstname = entity.firstname
        professorResponse.lastname = entity.lastname
        professorResponse.family_situation = entity.family_situation
        professorResponse.qualifications = entity.qualifications?.map((qualification:QualificationEntity)=>ProfessorMapper.qualificationEntity_To_qualificationResponse(qualification))
        return professorResponse
    }

    static qualificationEntity_To_qualificationResponse(entity:QualificationEntity):QualificationResponse{
        const qualificationResponse = new QualificationResponse()
        qualificationResponse.id = entity.id
        qualificationResponse.attachement = String(entity.attachement?.content?.toString("base64"))
        qualificationResponse.name = entity.name
        return qualificationResponse
    }

}