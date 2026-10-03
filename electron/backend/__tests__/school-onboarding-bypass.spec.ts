/**
 * @vitest-environment node
 *
 * GeneralInfoView onboarding : `school:save` / `school:saveSettings` sont
 * appelés par le ConfigurationWizard SANS user loggé (is-first-launch).
 * Sans `allowDuringFirstLaunch: true`, protectedHandle rejette en
 * UNAUTHENTICATED → UI affichait « Erreur lors de la sauvegarde ».
 * Garde-fou : le flag doit rester présent sur ces deux canaux.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function channelBlock(src: string, channel: string): string {
  // Cibler l'enregistrement protectedHandle (pas la table de rôles en tête de fichier).
  const idx = src.indexOf(`protectedHandle("${channel}"`);
  if (idx === -1) throw new Error(`canal ${channel} introuvable dans events.ts`);
  return src.slice(idx, idx + 800);
}

describe('school onboarding bypass — events.ts', () => {
  it('school:save et school:saveSettings autorisés pendant is-first-launch', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'events.ts'), 'utf-8');
    for (const ch of ['school:save', 'school:saveSettings']) {
      expect(channelBlock(src, ch)).toMatch(/allowDuringFirstLaunch:\s*true/);
    }
  });
});
