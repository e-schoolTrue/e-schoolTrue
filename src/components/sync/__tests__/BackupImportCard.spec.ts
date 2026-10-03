import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import BackupImportCard from '../BackupImportCard.vue';

function ipcInvokeMock() {
  return (window as unknown as Record<string, any>).ipcRenderer.invoke as ReturnType<typeof vi.fn>;
}

function mountCard(props: Record<string, any> = {}) {
  return mount(BackupImportCard, {
    props: { ...props } as any,
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: { Icon: { template: '<span />' } },
    },
  });
}

const validPreview = {
  success: true,
  data: {
    canceled: false,
    stagingPath: '/tmp/e-school/staging/validate-123/database.db',
    fileName: 'backup-20240101.zip',
    sourcePath: '/home/user/backup-20240101.zip',
    preview: {
      kind: 'zip',
      dbSize: 123456,
      tableCount: 25,
      userVersion: 3,
      hasUploads: true,
      sha256: 'sha256:abc123',
      warnings: [],
    },
    warnings: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  const invoke = ipcInvokeMock();
  invoke.mockReset();
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'set-first-launch-complete') return { success: true };
    return { success: true, data: [] };
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('BackupImportCard — import zip onboarding (choisir chemin → preview → confirm)', () => {
  it('preview valide affiche fileName + chemin choisi + staging + infos (taille, tables, version)', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return validPreview;
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    // Étape 1 : [Choisir .zip] — le bouton ouvre le sélecteur natif via backup:previewImport
    const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
    expect(trigger, 'bouton Importer sauvegarde').toBeTruthy();
    await trigger!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(invoke).toHaveBeenCalledWith('backup:previewImport');
    // Le dialogue (teleported via append-to-body) affiche le fichier choisi
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('backup-20240101.zip');
    expect(bodyText).toContain('/home/user/backup-20240101.zip');
    expect(bodyText).toContain('/tmp/e-school/staging/validate-123/database.db');
    // Infos : tables + version schéma
    expect(bodyText).toContain('25');
    expect(bodyText).toContain('3');
    wrapper.unmount();
  });

  it('confirm lance safety backup + relaunch (backup:confirmImport avec stagingPath)', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string, ...args: any[]) => {
      if (channel === 'backup:previewImport') return validPreview;
      if (channel === 'set-first-launch-complete') return { success: true };
      if (channel === 'backup:confirmImport') {
        expect(args[0]).toBe('/tmp/e-school/staging/validate-123/database.db');
        expect(args[1]).toBe(true);
        return { success: true, data: { relaunching: true, safetyBackup: 'pre-import-20240101.zip' } };
      }
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
    await trigger!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    // Étape 2 : [Confirmer import] dans le dialogue teleported
    const buttons = Array.from(document.body.querySelectorAll('button'));
    const confirmBtn = buttons.find((b) => b.textContent?.includes('Importer et redémarrer'));
    expect(confirmBtn, 'bouton Importer et redémarrer').toBeTruthy();
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
    (confirmBtn as HTMLButtonElement).click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(invoke).toHaveBeenCalledWith(
      'backup:confirmImport',
      '/tmp/e-school/staging/validate-123/database.db',
      true,
      expect.objectContaining({ acknowledgeMissingUploads: expect.any(Boolean), acknowledgeDowngrade: expect.any(Boolean) }),
    );
    expect(wrapper.emitted('imported')).toBeTruthy();
    expect(wrapper.emitted('imported')![0][0]).toMatchObject({ relaunching: true });
    wrapper.unmount();
  });

  it('sans fichier choisi (cancel) : pas de dialogue, pas de confirm possible', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return { success: true, data: { canceled: true } };
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
    await trigger!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('cancelled')).toBeTruthy();
    expect(wrapper.emitted('imported')).toBeFalsy();
    // Aucun dialogue teleported avec confirm actif
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('Importer et redémarrer');
    // Garde : confirmImport sans staging n'appelle jamais l'IPC
    const confirmCalls = invoke.mock.calls.filter((c) => c[0] === 'backup:confirmImport');
    expect(confirmCalls).toHaveLength(0);
    wrapper.unmount();
  });
});
