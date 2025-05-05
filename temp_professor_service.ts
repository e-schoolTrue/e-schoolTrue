async getAllProfessors(): Promise<IProfessorServiceResponse> {
    try {
        await this.ensureRepositoriesInitialized();
        const dataSource = AppDataSource.getInstance();
        
        const professors = await dataSource
            .getRepository(ProfessorEntity)
            .createQueryBuilder("professor")
            .leftJoinAndSelect("professor.photo", "photo")
            .leftJoinAndSelect("professor.documents", "documents")
            .leftJoinAndSelect("professor.diploma", "diploma")
            .leftJoinAndSelect("professor.qualification", "qualification")
            .leftJoinAndSelect("professor.teaching", "teaching")
            .leftJoinAndSelect("teaching.class", "class")
            .leftJoinAndSelect("teaching.course", "course")
            .leftJoinAndSelect("teaching.grades", "grades")
            .getMany();
        
        const mappedProfessors = professors.map(professor => this.mapToProfessorDetails(professor));
        
        return {
            success: true,
            data: mappedProfessors,
            message: 'Professeurs récupérés avec succès',
            error: null
        };
    } catch (error) {
        console.error('Erreur dans getAllProfessors:', error);
        return {
            success: false,
            data: null,
            message: 'Erreur lors de la récupération des professeurs',
            error: error instanceof Error ? error.message : 'Erreur inconnue'
        };
    }
}

// Dans la méthode updateProfessor, remplacer la récupération finale par :
const finalProfessor = await dataSource
    .getRepository(ProfessorEntity)
    .createQueryBuilder("professor")
    .leftJoinAndSelect("professor.photo", "photo")
    .leftJoinAndSelect("professor.documents", "documents")
    .leftJoinAndSelect("professor.diploma", "diploma")
    .leftJoinAndSelect("professor.qualification", "qualification")
    .leftJoinAndSelect("professor.teaching", "teaching")
    .leftJoinAndSelect("teaching.class", "class")
    .leftJoinAndSelect("teaching.course", "course")
    .leftJoinAndSelect("teaching.grades", "grades")
    .where("professor.id = :id", { id: existingProfessor.id })
    .getOne(); 