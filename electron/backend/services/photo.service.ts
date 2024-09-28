// @ts-nocheck
import {User} from "../entities/auth.ts";

export async function testDb(...args: any){
    const users = await User.find()
    console.log("photo: " , users)
}
