import {FileCommand} from "@electron/command/fileCommand.ts";
import {AppDataSource} from "@electron/data-source.ts";
import {EntityManager} from "typeorm";
import {FileMapper} from "@electron/mappers/fileMapper.ts";
import {ResultType} from "@electron/command";
import {FileEntity} from "@electron/entities/file.ts";

export class FileService {

    async saveFile(command:FileCommand): Promise<ResultType> {
        try {
            return await AppDataSource.getInstance().transaction(async(entityManager:EntityManager):Promise<ResultType>=>{
                const savedFile = await entityManager.save(FileMapper.fileCommand_To_fileEntity(command))
                return {success:true , error:null , data: FileMapper.fileEntity_To_fileResponse(savedFile) , message:""}
            })
        }catch (e:any) {
            return {success:false , error:e.message , data:null , message:""}
        }
    }
    async deleteFile(file_id:number): Promise<ResultType> {
        try {
            return await AppDataSource.getInstance().transaction(async(entityManager:EntityManager):Promise<ResultType>=>{
                await entityManager.delete(FileEntity , {id:file_id})
                return {success:true , error:null , data:null , message:""}
            })
        }catch (e:any) {
            return {success:false , error:e.message , data:null , message:""}
        }
    }
    async findFileById(file_id:number): Promise<ResultType> {
        try {
            return await AppDataSource.getInstance().transaction(async(entityManager:EntityManager):Promise<ResultType>=>{
                const foundedFile = await entityManager.find<FileEntity>(FileEntity , {
                    where:{id:file_id?file_id:0}
                })
                return {success:true , error:null , data: FileMapper.fileEntity_To_fileResponse(foundedFile[0]) , message:""}
            })
        }catch (e:any) {
            return {success:false , error:e.message , data:null , message:""}
        }
    }
}
