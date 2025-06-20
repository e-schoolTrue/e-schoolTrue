import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface AppConfig {
  isFirstLaunchComplete: boolean;
}

export class ConfigService {
  private static instance: ConfigService;
  private configPath: string;
  private config: AppConfig;

  private constructor() {
    this.configPath = path.join(app.getPath('userData'), 'app-config.json');
    this.config = this.loadConfig();
  }

  // Utiliser un Singleton pour s'assurer qu'il n'y a qu'une seule instance
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const rawData = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(rawData);
      }
    } catch (error) {
      console.error("Erreur de chargement de app-config.json, réinitialisation.", error);
    }
    // Par défaut, le wizard n'est pas complété
    return { isFirstLaunchComplete: false };
  }

  private saveConfig(): void {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  public isFirstLaunch(): boolean {
    // "Premier lancement" signifie que le wizard n'a pas encore été marqué comme complété
    return !this.config.isFirstLaunchComplete;
  }

  public setFirstLaunchComplete(): void {
    if (!this.config.isFirstLaunchComplete) {
      this.config.isFirstLaunchComplete = true;
      this.saveConfig();
      console.log('Configuration mise à jour : le premier lancement est maintenant considéré comme terminé.');
    }
  }
}