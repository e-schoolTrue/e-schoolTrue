import {FileEntity} from "@electron/entities/file.ts";
import {FileCommand} from "@electron/command/fileCommand.ts";
import {FileResponse} from "@electron/response/fileResponse.ts";


export class FileMapper{
    static fileCommand_To_fileEntity(command:FileCommand):FileEntity{
        const fileEntity = new FileEntity()
        fileEntity.name = command.name
        fileEntity.type = command.type
        fileEntity.id = command.id
        const base64Data = command.content?.replace(/^data:image\/png;base64,/, '');
        fileEntity.content = Buffer.from(String(base64Data), 'base64')
        return fileEntity
    }

    static fileEntity_To_fileResponse(entity:FileEntity):FileResponse{
        const fileResponse = new FileResponse()
        fileResponse.id = entity.id
        fileResponse.type = entity.type
        fileResponse.name = entity.name
        fileResponse.content = entity.content?.toString("base64")
        return fileResponse
    }
}