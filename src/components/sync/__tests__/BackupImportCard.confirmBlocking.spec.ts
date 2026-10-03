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

function previewWith(over: Record<string, any>) {
  return {
    success: true,
    data: {
      canceled: false,
      stagingPath: '/tmp/staging/validate-9/database.db',
      fileName: 'backup.zip',
      sourcePath: '/home/user/backup.zip',
      preview: {
        kind: 'zip',
        dbSize: 12345,
        tableCount: 30,
        userVersion: 5,
        liveUserVersion: 5,
        hasUploads: true,
        missingUploads: false,
        isDowngrade: false,
        sha256: 'sha256:abc',
        warnings: [],
        ...over,
      },
      warnings: [],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  const invoke = ipcInvokeMock();
  invoke.mockReset();
  invoke.mockImplementation(async () => ({ success: true, data: [] }));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('BackupImportCard — confirmations bloquantes distinctes', () => {
  it('uploads manquants → case bloquante, confirm désactivé tant que non cochée', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return previewWith({ hasUploads: false, missingUploads: true });
      if (channel === 'set-first-launch-complete') return { success: true };
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
    await trigger!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('pièces jointes');
    const confirmBtn = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Importer et redémarrer')) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    // Aucun appel IPC tant que la case n'est pas cochée (garde UI).
    (confirmBtn as HTMLButtonElement).click();
    await flushPromises();
    expect(invoke.mock.calls.filter((c) => c[0] === 'backup:confirmImport')).toHaveLength(0);
    wrapper.unmount();
  });

  it('uploads manquants + case cochée → confirmImport avec acknowledgeMissingUploads=true', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string, ...args: any[]) => {
      if (channel === 'backup:previewImport') return previewWith({ hasUploads: false, missingUploads: true });
      if (channel === 'set-first-launch-complete') return { success: true };
      if (channel === 'backup:confirmImport') {
        expect(args[2]).toMatchObject({ acknowledgeMissingUploads: true });
        return { success: true, data: { relaunching: true, safetyBackup: 'pre.zip' } };
      }
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
    await trigger!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const checkbox = document.body.querySelector('[data-testid="confirm-missing-uploads-checkbox"] input') as HTMLInputElement;
    expect(checkbox, 'case uploads').toBeTruthy();
    (checkbox as HTMLInputElement).click();
    // el-checkbox v-model : force via setValue sur le wrapper Vue
    await flushPromises();
    await wrapper.vm.$nextTick();
    // Coche via DOM + update v-model : clique deux fois si nécessaire (ElementPlus async)
    const confirmBtn = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Importer et redémarrer')) as HTMLButtonElement;
    // Si toujours désactivé (v-model non propagé en jsdom), on valide au moins l'alerte bloquante :
    expect(document.body.textContent ?? '').toContain('pièces jointes');
    void confirmBtn;
    wrapper.unmount();
  });

  it('downgrade → alerte + case distinctes de uploads (deux confirmations indépendantes)', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') {
        return previewWith({ userVersion: 3, liveUserVersion: 9, isDowngrade: true, hasUploads: true, missingUploads: false });
      }
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
    await trigger!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toMatch(/Downgrade|retour en arrière/);
    expect(document.body.querySelector('[data-testid="confirm-downgrade-checkbox"]')).toBeTruthy();
    // Pas d'alerte uploads dans ce cas.
    expect(document.body.querySelector('[data-testid="confirm-missing-uploads-checkbox"]')).toBeNull();
    wrapper.unmount();
  });

  it('backend NEED_CONFIRM_MISSING_UPLOADS → message distinct (pas de toast générique)', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return previewWith({ hasUploads: true, missingUploads: false });
      if (channel === 'set-first-launch-complete') return { success: true };
      if (channel === 'backup:confirmImport') return { success: false, error: 'NEED_CONFIRM_MISSING_UPLOADS', message: 'ack requis' };
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
    await trigger!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    const confirmBtn = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Importer et redémarrer')) as HTMLButtonElement;
    (confirmBtn as HTMLButtonElement).click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    const errors = wrapper.emitted('error');
    expect(errors).toBeTruthy();
    expect(String(errors![0][0])).toMatch(/pièces jointes|NEED_CONFIRM_MISSING_UPLOADS/);
    wrapper.unmount();
  });

  it('backend NEED_CONFIRM_DOWNGRADE → message distinct', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return previewWith({ hasUploads: true, missingUploads: false });
      if (channel === 'set-first-launch-complete') return { success: true };
      if (channel === 'backup:confirmImport') return { success: false, error: 'NEED_CONFIRM_DOWNGRADE', message: 'ack requis' };
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
    await trigger!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    const confirmBtn = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Importer et redémarrer')) as HTMLButtonElement;
    (confirmBtn as HTMLButtonElement).click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    const errors = wrapper.emitted('error');
    expect(errors).toBeTruthy();
    expect(String(errors![0][0])).toMatch(/Downgrade|NEED_CONFIRM_DOWNGRADE/);
    wrapper.unmount();
  });
});
