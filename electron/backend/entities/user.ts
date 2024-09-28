import {Entity, PrimaryGeneratedColumn} from "typeorm";
import {ROLE} from "#electron/command";

@Entity("user")
export class UserEntity{
    @PrimaryGeneratedColumn()
    id?:number
    username?:string
    password?:string
    role?:ROLE
}