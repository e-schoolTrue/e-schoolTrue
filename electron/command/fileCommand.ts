import {FILE_TYPE} from "@electron/command/index.ts";

export class FileCommand{
    id?:number;
    type?:FILE_TYPE;
    name?:string;
    content?:string;
}