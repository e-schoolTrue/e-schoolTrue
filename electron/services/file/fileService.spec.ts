import {expect, it, describe, afterAll, beforeAll} from "vitest";
import {AppDataSource} from "@electron/data-source.ts";
import {FileCommand} from "@electron/command/fileCommand.ts";
import {FILE_TYPE} from "@electron/command";
import {FileService} from "@electron/services/file/fileService.ts";
import {EntityManager} from "typeorm";
import {FileEntity} from "@electron/entities/file.ts";

var fileCommand = new FileCommand()
var fileService = new FileService()

describe("fileService" , ()=>{
    beforeAll(async()=>{
        await AppDataSource.getInstance().initialize()
    })
    it("it should save file into data base in raw  binary format" , async()=>{
        fileCommand.content = "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
        fileCommand.type = FILE_TYPE.png
        fileCommand.name = "teste.png"
        const result = await fileService.saveFile(fileCommand)
        expect(result.success).toBe(true)
        expect(result.data?.type).eq( FILE_TYPE.png)
        expect(result.data?.name).eq(fileCommand.name)
        expect(result.data?.content).eq(fileCommand.content)
    })

    it("it should delete file into data base" , async()=>{
        fileCommand.content = "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
        fileCommand.type = FILE_TYPE.png
        fileCommand.name = "teste.png"
        const result = await fileService.saveFile(fileCommand)
        expect(result.success).toBe(true)
        const deleteResult = await fileService.deleteFile(result.data.id)
        expect(deleteResult.success).toBe(true)
    })
    it("should able to find file by it id" , async()=>{
        fileCommand.content = "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
        fileCommand.type = FILE_TYPE.png
        fileCommand.name = "teste.png"
        const result = await fileService.saveFile(fileCommand)
        expect(result.success).toBe(true)
        const findByIdResult = await fileService.findFileById(result.data.id)
        console.log("data: ", findByIdResult.data)
        expect(findByIdResult.success).toBe(true)
        expect(findByIdResult.data?.id).toBeDefined
        expect(findByIdResult.data?.type).toBe(fileCommand.type)
        expect(findByIdResult.data?.name).toBe(fileCommand.name)
        expect(findByIdResult.data?.content).toBe(fileCommand.content)
    })
    afterAll(async()=>{
        await AppDataSource.getInstance().transaction(async(entityManager:EntityManager)=>{
            await entityManager.delete(FileEntity , {})
        })
        await AppDataSource.getInstance().destroy()
    })
})
