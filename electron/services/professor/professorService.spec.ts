import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {AppDataSource} from "@electron/data-source.ts";
import {EntityManager} from "typeorm";
import {ProfessorEntity, QualificationEntity} from "@electron/entities/professor.ts";
import {ProfessorService} from "@electron/services/professor/professorService.ts";
import {ProfessorCommand, QualificationCommand} from "@electron/command/professorCommand.ts";
import {FileCommand} from "@electron/command/fileCommand.ts";
import {FileService} from "@electron/services/file/fileService.ts";
import {CIVILITY, FAMILY_SITUATION, FILE_TYPE} from "@electron/command";
import {FileEntity} from "@electron/entities/file.ts";


const professorService = new ProfessorService()
const fileService = new FileService()
const professorCommand = new ProfessorCommand()
const fileCommand = new FileCommand()

function settupProfessorData(){
    professorCommand.address="address"
    professorCommand.birth_date = new Date(Date.now())
    professorCommand.birth_country = "guinée"
    professorCommand.birth_town = "connakry"
    professorCommand.cni_number = "29429429"
    professorCommand.firstname = "oumar"
    professorCommand.lastname = "diane"
    professorCommand.civility = CIVILITY.Mr
    professorCommand.family_situation = FAMILY_SITUATION.Maried
    professorCommand.phone_number = "+2246222228148"
    professorCommand.town = "connakry"
    professorCommand.qualifications = []
}
function settupFileData(){
    fileCommand.content = "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
    fileCommand.type = FILE_TYPE.png
    fileCommand.name = "teste.png"
}
describe("professorService" , ()=>{
    beforeAll(async()=>{
        await AppDataSource.getInstance().initialize()
    })

    it("should save new professor and it qualifications" , async()=>{
        settupFileData()
        const result = await fileService.saveFile(fileCommand)
        expect(result.success).toBe(true)
        const qualification1Data = new QualificationCommand()
        settupProfessorData()
        qualification1Data.name = "bac"
        qualification1Data.attachement_id = result.data.id
        professorCommand.qualifications?.push(qualification1Data)
        const professorResult = await professorService.saveProfessor(professorCommand)
        expect(professorResult.success).toBe(true)
        expect(professorResult.data.length).toBeGreaterThan(0)
        console.log("data: " , professorResult.data)
        expect(professorResult.data[0].birth_date).toBeDefined
        expect(professorResult.data[0].civility).toBe(professorCommand.civility)
        expect(professorResult.data[0].birth_town).toBe(professorCommand.birth_town)
        expect(professorResult.data[0].cni_number).toBe(professorCommand.cni_number)
        expect(professorResult.data[0].address).toBe(professorCommand.address)
        expect(professorResult.data[0].birth_country).toBe(professorCommand.birth_country)
        expect(professorResult.data[0].firstname).toBe(professorCommand.firstname)
        expect(professorResult.data[0].lastname).toBe(professorCommand.lastname)
        expect(professorResult.data[0].family_situation).toBe(professorCommand.family_situation)
        expect(professorResult.data[0].phone_number).toBe(professorCommand.phone_number)
    })

    afterAll(async()=>{
        await AppDataSource.getInstance().transaction(async(entityManager:EntityManager)=>{
            await entityManager.delete(ProfessorEntity , {})
            await entityManager.delete(QualificationEntity , {})
            await entityManager.delete(FileEntity , {})
        })
        await AppDataSource.getInstance().destroy()
    })
})
