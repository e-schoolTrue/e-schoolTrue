
export interface Homework {
    id: number;
    description: string;
    dueDate: Date;
    courseId: number;
    gradeId: number;
    professorId: number;
    isCompleted: boolean;
    created_at: Date;
}

export interface HomeworkCreateInput {
    description: string;
    dueDate: Date;
    courseId: number;
    gradeId: number;
    professorId: number;
}

export interface HomeworkUpdateInput extends Partial<HomeworkCreateInput> {
    isCompleted?: boolean;
}
