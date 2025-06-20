export interface IFileData {
    id: number;
    name: string;
    type: string;
    path?: string;
    created_at?: Date;
    content?: string;
}

export interface IFileUpload {
    content: string;
    name: string;
    type: string;
}

export interface IFileServiceResponse {
    success: boolean;
    data: IFileData | IFileData[] | null;
    message: string;
    error: string | null;
}

export interface IFileServiceParams {
    saveFile: IFileUpload;
    saveDocuments: {
        documents: IFileUpload[];
        professorId: number;
    };
    getFileById: {
        fileId: number;
    };
    getFileUrl: {
        fileId: number;
    };
}

export interface IFileResponse {
    id: number;
    content: Buffer;
    type: string;
    name: string;
    path: string;
}
