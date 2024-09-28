import {ElLoading} from "element-plus";

export class Loader{
    static loadingInstance: any;
    static showLoader(text: string = "Chargement..."){
        this.loadingInstance = ElLoading.service({
            lock: true,
            text: text,
            background: 'rgba(0, 0, 0, 0.7)'
        });
    }
    static hideLoader(){
        this.loadingInstance.close();
    }
}

