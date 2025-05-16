import { FileEntity } from "../entities/file";
import { AppDataSource } from "#electron/data-source"; 

export class PhotoService {
  private fileRepository = AppDataSource.getInstance().getRepository(FileEntity);

  async savePhoto(photoData: Partial<FileEntity>): Promise<any> {
    try {
      console.log("Début de la sauvegarde de la photo : ", photoData);  // Debug: afficher les données de la photo

      const newPhoto = this.fileRepository.create(photoData);
      console.log("Photo créée avec succès : ", newPhoto);  // Debug: photo après création

      await this.fileRepository.save(newPhoto);
      console.log("Photo sauvegardée dans la base de données");  // Debug: confirmation de la sauvegarde

      return {
        success: true,
        data: newPhoto,
        message: "Photo enregistrée avec succès",
      };
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la photo : ", error);  // Debug: afficher l'erreur
      return {
        success: false,
        error: error,
        message: "Échec de l'enregistrement de la photo",
      };
    }
  }

  async getAllPhotos(): Promise<any> {
    try {
      console.log("Récupération de toutes les photos...");  // Debug: démarrer la récupération des photos
      const photos = await this.fileRepository.find();
      console.log("Photos récupérées : ", photos);  // Debug: afficher les photos récupérées
      return {
        success: true,
        data: photos,
      };
    } catch (error) {
      console.error("Erreur lors de la récupération des photos : ", error);  // Debug: afficher l'erreur
      return {
        success: false,
        error: error,
      };
    }
  }
}
