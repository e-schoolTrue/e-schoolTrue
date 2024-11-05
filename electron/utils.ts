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

export function blobToBase64(blob:Blob) {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
    });
}

export function b64toBlob(b64Data:string, contentType:string='', sliceSize:number=512):Blob{
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);

        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, {type: contentType});
}