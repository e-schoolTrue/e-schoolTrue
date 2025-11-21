import { AppDataSource } from '../../data-source'
import { DocumentContentEntity } from '../entities/documentContent'

const defaultInscription = `
<div class="header">
  <div class="school-header">
    <div class="logo-block">
      <img src="{{logo_url}}" alt="Logo" class="school-logo" />
    </div>
    <div class="school-info">
      <h1 class="school-name">{{nom_ecole}}</h1>
      <p class="school-line">{{adresse_ecole}}</p>
      <p class="school-line">{{ville_pays}}</p>
      <p class="school-line">Tél : {{telephone_ecole}}</p>
      <p class="school-line">Email : {{email_ecole}}</p>
    </div>
  </div>
  <h2 class="document-title">ATTESTATION D'INSCRIPTION</h2>
</div>
<div class="body">
  <p>Je soussigné(e) <strong>{{nom_directeur}}</strong>, Directeur/Directrice de l'établissement <strong>{{nom_ecole}}</strong>, certifie que :</p>
  <div class="fields">
    <div class="field"><span class="label">NOM :</span><span class="value">{{nom_eleve}}</span></div>
    <div class="field"><span class="label">Prénom :</span><span class="value">{{prenom_eleve}}</span></div>
    <div class="field"><span class="label">Né(e) le :</span><span class="value">{{date_naissance_eleve}}</span></div>
    <div class="field"><span class="label">À :</span><span class="value">{{lieu_naissance_eleve}}</span></div>
  </div>
  <p class="paragraph">est inscrit(e) sur les registres de notre établissement au sein de la classe de <strong>{{programme}}</strong> pour l’année
  scolaire <strong>{{annee_scolaire}}</strong>, sur le campus <strong>{{campus}}</strong>.</p>
  <div class="signature-row">
    <div class="date">Fait à {{ville}}, le <strong>{{date_jour}}</strong></div>
    <div class="director">La Direction</div>
  </div>
  <div class="footer-note">Page 1 sur 1</div>
</div>
`;

const defaultScolarite = `
<div class="header">
  <div class="school-header">
    <div class="logo-block">
      <img src="{{logo_url}}" alt="Logo" class="school-logo" />
    </div>
    <div class="school-info">
      <h1 class="school-name">{{nom_ecole}}</h1>
      <p class="school-line">{{adresse_ecole}}</p>
      <p class="school-line">{{ville_pays}}</p>
      <p class="school-line">Tél : {{telephone_ecole}}</p>
      <p class="school-line">Email : {{email_ecole}}</p>
    </div>
  </div>
  <h2 class="document-title">CERTIFICAT DE SCOLARITÉ</h2>
</div>
<div class="body">
  <p>Je soussigné(e) <strong>{{nom_directeur}}</strong>, Directeur/Directrice de l'établissement <strong>{{nom_ecole}}</strong>, certifie que :</p>
  <div class="fields">
    <div class="field"><span class="label">NOM :</span><span class="value">{{nom_eleve}}</span></div>
    <div class="field"><span class="label">Prénom :</span><span class="value">{{prenom_eleve}}</span></div>
    <div class="field"><span class="label">Né(e) le :</span><span class="value">{{date_naissance_eleve}}</span></div>
    <div class="field"><span class="label">À :</span><span class="value">{{lieu_naissance_eleve}}</span></div>
  </div>
  <p class="paragraph">est inscrit(e) sur les registres de notre établissement au sein du programme <strong>{{programme}}</strong> pour l’année
  universitaire <strong>{{annee_scolaire}}</strong>, sur le campus <strong>{{campus}}</strong>.</p>
  <div class="signature-row">
    <div class="date">Fait à {{ville}}, le <strong>{{date_jour}}</strong></div>
    <div class="director">La Direction</div>
  </div>
  <div class="footer-note">Page 1 sur 1</div>
</div>
`;

export const documentContentService = {
  getRepository() {
    return AppDataSource.getInstance().getRepository(DocumentContentEntity);
  },

  async get() {
    const repo = this.getRepository();
    const contents = await repo.find()
    if (contents.length > 0) {
      return contents[0]
    }
    const defaultContent = repo.create({
      inscription: defaultInscription,
      scolarite: defaultScolarite,
    })
    return repo.save(defaultContent)
  },

  async update(data: Partial<DocumentContentEntity>) {
    const repo = this.getRepository();
    const contents = await repo.find()
    if (contents.length > 0) {
      const updatedContent = repo.merge(contents[0], data)
      return repo.save(updatedContent)
    }
    const newContent = repo.create(data)
    return repo.save(newContent)
  },
}
