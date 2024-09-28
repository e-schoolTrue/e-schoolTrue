import {ipcMain} from "electron";
import {GradeService} from "#electron/backend/services/gradeService.ts";
import {BranchCommand, ClassRoomCommand, CourseCommand, GradeCommand} from "#electron/command/settingsCommand.ts";
import {CourseService} from "#electron/backend/services/courseService.ts";
import { StudentService } from "./backend/services/studentService";

const global = {
    gradeService:new GradeService(),
    courseService:new CourseService(),
    studentService: new StudentService()
}


ipcMain.handle("grade:all"  , async (event, args)=>{
    console.log("grade:all " , event , args)
    return await global.gradeService.getGrades();
})

ipcMain.handle("grade:new"  , async (event, command:GradeCommand)=>{
    console.log("grade:new " , event)
    return await global.gradeService.newGrade(command);
})

ipcMain.handle("grade:update"  , async (event, command:GradeCommand)=>{
    console.log("grade:update " , event)
    return await global.gradeService.updateGrade(command);
})

ipcMain.handle("grade:delete"  , async (event, id:number)=>{
    console.log("grade:delete " , event)
    return await global.gradeService.deleteGrade(id);
})

ipcMain.handle("classRoom:new"  , async (event, command:ClassRoomCommand)=>{
    console.log("classRoom:new " , event)
    return await global.gradeService.newClassRoom(command);
})

ipcMain.handle("classRoom:delete"  , async (event, id:number)=>{
    console.log("classRoom:delete " , event)
    return await global.gradeService.deleteClassRoom(id);
})

ipcMain.handle("classRoom:update"  , async (event, command:ClassRoomCommand)=>{
    console.log("classRoom:update " , event)
    return await global.gradeService.updateClassRoom(command);
})

ipcMain.handle("classRoom:all"  , async (event, args)=>{
    console.log("classRoom:all " , event , args)
    return await global.gradeService.getClassRooms();
})

ipcMain.handle("branch:new"  , async (event, command:BranchCommand)=>{
    console.log("branch:new " , event)
    return await global.gradeService.newBranch(command);
})

ipcMain.handle("branch:update"  , async (event, command:BranchCommand)=>{
    console.log("branch:update " , event)
    return await global.gradeService.updateBranch(command);
})

ipcMain.handle("branch:delete"  , async (event, id:number)=>{
    console.log("branch:delete " , event)
    return await global.gradeService.deleteBranch(id);
})

ipcMain.handle("course:new"  , async (event, command:CourseCommand)=>{
    console.log("course:new " , event)
    return await global.courseService.newCourse(command);
})

ipcMain.handle("courseGroup:add"  , async (event, command:CourseCommand)=>{
    console.log("courseGroup:add " , event)
    return await global.courseService.addCourseToGroupement(command);
})

ipcMain.handle("course:update"  , async (event, command:CourseCommand)=>{
    console.log("course:update " , event)
    return await global.courseService.updateCourse(command);
})

ipcMain.handle("course:delete"  , async (event, id:number)=>{
    console.log("course:delete " , event)
    return await global.courseService.deleteCourse(id);
})

ipcMain.handle("course:all"  , async (event, args)=>{
    console.log("course:all " , event , args)
    return await global.courseService.getAllCourse();
})

ipcMain.handle("save-student", async (event, studentData) => {
    console.log("save-student", event, studentData);
    try {
        return await global.studentService.saveStudent(studentData);
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'étudiant:', error);
        return { success: false, message: 'Erreur lors de la sauvegarde.' };
    }
});
ipcMain.handle("student:all"  , async (event, args)=>{
    console.log("student:all " , event , args)
    return await global.studentService.getAllStudents();
})
