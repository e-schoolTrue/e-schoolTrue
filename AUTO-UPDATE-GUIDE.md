# Guide de la fonctionnalité de Mise à Jour Automatique

Ce document explique comment fonctionne la fonctionnalité de mise à jour automatique dans l'application eSchool et comment la tester.

## Fonctionnement

La fonctionnalité de mise à jour automatique utilise `electron-updater` pour vérifier, télécharger et installer automatiquement les mises à jour de l'application. Voici comment cela fonctionne :

1. **Vérification des mises à jour** : L'application vérifie automatiquement les mises à jour au démarrage et toutes les 24 heures.
2. **Téléchargement** : Si une mise à jour est disponible, elle est téléchargée en arrière-plan.
3. **Notification** : L'utilisateur est informé qu'une mise à jour est disponible et peut choisir de l'installer immédiatement ou plus tard.
4. **Installation** : L'installation se fait automatiquement au redémarrage de l'application.

## Configuration

### Fichiers de configuration

- `electron-builder.json5` : Configuration de base pour la construction et la publication
- `app-update.yml` : Configuration pour les mises à jour en production
- `dev-app-update.yml` : Configuration pour les tests en développement

### Variables d'environnement

- `GH_TOKEN` : Token d'accès GitHub pour la publication des mises à jour
- `NODE_ENV` : `development` ou `production` (définit le mode de fonctionnement)

## Test en mode développement

1. **Configurer le serveur local** :
   ```bash
   # Installer le serveur local pour les mises à jour
   npm install -g serve
   
   # Créer un dossier pour les mises à jour
   mkdir -p update/dev
   
   # Démarrer le serveur dans le dossier des mises à jour
   cd update && serve -p 3000
   ```

2. **Créer une version de test** :
   ```bash
   # Construire l'application en mode développement
   npm run build:dev
   
   # Copier les fichiers dans le dossier de mise à jour
   cp -r dist/electron/win-unpacked/* update/dev/
   ```

3. **Tester la mise à jour** :
   - Lancer l'application : `npm start:dev`
   - L'application devrait vérifier les mises à jour au démarrage
   - Pour forcer une vérification, utilisez le bouton dans l'interface

## Déploiement en production

1. **Préparer la version** :
   ```bash
   # Construire l'application pour la production
   npm run build:prod
   ```

2. **Publier sur GitHub** :
   ```bash
   # Remplacer par votre token GitHub
   export GH_TOKEN=votre_token_github
   
   # Publier la version
   npm run publish:github
   ```

3. **Vérifier la publication** :
   - Allez sur la page des releases de votre dépôt GitHub
   - Une nouvelle release en brouillon devrait être créée
   - Publiez la release pour la rendre disponible

## Dépannage

### Problèmes courants

- **Les mises à jour ne sont pas détectées** :
  - Vérifiez que le serveur de mise à jour est accessible
  - Vérifiez les logs de l'application
  - Assurez-vous que la version dans `package.json` a été incrémentée

- **Erreurs de signature** :
  - Assurez-vous que le certificat de signature de code est correctement configuré
  - Vérifiez que les fichiers sont correctement signés

### Journaux

Les journaux de mise à jour sont enregistrés dans :
- Windows : `%APPDATA%\eSchool\logs\updater.log`
- macOS : `~/Library/Logs/eSchool/updater.log`
- Linux : `~/.config/eSchool/logs/updater.log`

## Personnalisation

### Changer l'URL du serveur de mises à jour

1. Pour le développement, modifiez `dev-app-update.yml`
2. Pour la production, modifiez `app-update.yml`

### Modifier la fréquence de vérification

La fréquence de vérification est définie dans `electron/main.ts` dans la fonction `setupAutoUpdater()`. Par défaut, elle est de 24 heures.

## Sécurité

- Toutes les mises à jour sont signées et vérifiées avant l'installation
- Les téléchargements se font en HTTPS
- Les tokens d'accès ne doivent jamais être commités dans le dépôt

---

Pour toute question ou problème, veuillez consulter la documentation d'[electron-updater](https://www.electron.build/auto-update) ou ouvrir une issue dans le dépôt.
