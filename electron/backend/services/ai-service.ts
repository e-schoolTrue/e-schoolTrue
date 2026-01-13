import { GoogleGenerativeAI } from "@google/generative-ai";
import { ENV } from "../../config/env";

export class AIService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor() {
        if (ENV.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        } else {
            console.warn("[AIService] API Key manquante, service désactivé.");
        }
    }

    async generateContent(prompt: string): Promise<{ success: boolean; content?: string; error?: string }> {
        if (!this.model) {
            return { success: false, error: "Service IA non configuré (Clé API manquante)" };
        }

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            return { success: true, content: text };
        } catch (error: any) {
            console.error("[AIService] Erreur de génération:", error);
            return { success: false, error: error.message || "Erreur lors de la génération" };
        }
    }
}
