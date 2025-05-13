import {ElLoading, ElMessage} from "element-plus";

export function openErrorNotification(message: string) {
    ElMessage.error(message);
}

export class Loader{
    static loadingInstance: any;
    static showLoader(text: string = "Chargement...", cancellable: boolean = false){
        this.loadingInstance = ElLoading.service({
            lock: true,
            text: text,
            background: 'rgba(0, 0, 0, 0.7)',
            customClass: cancellable ? 'cancellable-loader' : ''
        });

        if (cancellable) {
            const cancelButton = document.createElement('button');
            cancelButton.className = 'el-button el-button--danger';
            cancelButton.textContent = 'Annuler';
            cancelButton.onclick = () => {
                this.hideLoader();
                // Émettre un événement personnalisé pour notifier l'annulation
                window.dispatchEvent(new CustomEvent('loader-cancelled'));
            };
            this.loadingInstance.$el.appendChild(cancelButton);
        }
    }
    static hideLoader(){
        if (this.loadingInstance) {
            this.loadingInstance.close();
            this.loadingInstance = null;
        }
    }
}

