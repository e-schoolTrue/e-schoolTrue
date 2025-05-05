export interface Homework {
    id: number;
    description: string;
    dueDate: Date;
    courseId: number;
    gradeId: number;
    professorId: number;
    isCompleted: boolean;
    createdAt: Date;
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
