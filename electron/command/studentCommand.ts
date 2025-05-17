import {FileEntity} from "#electron/backend/entities/file";


export type StudentCommand = {
    id?: number
    firstname?: string
    lastname?: string
    matricule?:string
    fatherFirstname?:string
    fatherLastname?:string
    motherFirstname?:string
    motherLastname?:string
    createdAt?: Date
    photo?:FileEntity
    documents?:FileEntity
    birthDay?:Date
    birthPlace?:string
    address?:string
    famillyPhone?:string
    personalPhone?:string
}