import {MimeType} from "./enum";


export function getFileMimeType(header: string){
    switch (header) {
        case "89504e47":
            return MimeType.PNG;
        case "47494638":
            return MimeType.GIF;
        case "ffd8ffe0":
            return MimeType.JPEG;
        case "ffd8ffe1":

        case "ffd8ffe2":
        case "ffd8ffe3":
        case "ffd8ffe8":
            return "image/jpeg";
        default:
            return "unknown"; // Or you can use the blob.type as fallback
    }
}