export interface IScheduleData {
    id: number;
    professorId: number;
    courseId: number;
    classId: number;
    day: string;
    timeSlot: string;
    createdAt: Date;
    updatedAt: Date;
    
    // Relations
    professor?: {
        id: number;
        firstname: string;
        lastname: string;
        civility: string;
        qualification?: {
            id: number;
            name: string;
        };
        photo?: {
            id: number;
            name: string;
            type: string;
        };
    };
    
    course?: {
        id: number;
        name: string;
    };
    
    class?: {
        id: number;
        name: string;
        schoolType?: string;
    };
}

export interface IScheduleServiceResponse {
    success: boolean;
    message: string;
    data: IScheduleData | IScheduleData[] | { id: number } | null;
    error: string | null;
}
