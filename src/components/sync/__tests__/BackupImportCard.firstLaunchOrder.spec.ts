import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import BackupImportCard from '../BackupImportCard.vue';

function ipcInvokeMock() {
  return (window as unknown as Record<string, any>).ipcRenderer.invoke as ReturnType<typeof vi.fn>;
}

function mountCard(props: Record<string, any> = {}) {
  return mount(BackupImportCard, {
    props: { requireAdmin: false, ...props } as any,
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: { Icon: { template: '<span />' } },
    },
  });
}

// Preview 13.2 Mo / 54 tables (screenshot onboarding).
function preview132Mo() {
  return {
    success: true,
    data: {
      canceled: false,
      stagingPath: '/tmp/e-school/staging/validate-132/database.db',
      fileName: 'backup-13mo.zip',
      sourcePath: '/home/user/backup-13mo.zip',
      preview: {
        kind: 'zip',
        dbSize: Math.round(13.2 * 1024 * 1024),
        tableCount: 54,
        userVersion: 7,
        hasUploads: true,
        missingUploads: false,
        isDowngrade: false,
        sha256: 'sha256:132mo',
        warnings: [],
      },
      warnings: [],
    },
  };
}

async function openPreview(wrapper: ReturnType<typeof mountCard>) {
  const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
  expect(trigger, 'bouton Importer sauvegarde').toBeTruthy();
  await trigger!.trigger('click');
  await flushPromises();
  await wrapper.vm.$nextTick();
}

function confirmBtn(): HTMLButtonElement {
  const btn = Array.from(document.body.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Importer et redémarrer'),
  ) as HTMLButtonElement;
  expect(btn, 'bouton Importer et redémarrer').toBeTruthy();
  return btn;
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  localStorage.clear();
  const invoke = ipcInvokeMock();
  invoke.mockReset();
  invoke.mockImplementation(async () => ({ success: true, data: [] }));
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.clearAllMocks();
});

describe('BackupImportCard — ordre first-launch (regression IPC backup:confirmImport)', () => {
  it('preview OK 13.2 Mo / 54 tables → confirm AVANT set-first-launch-complete, flag localStorage après succès', async () => {
    const invoke = ipcInvokeMock();
    const order: string[] = [];
    invoke.mockImplementation(async (channel: string) => {
      order.push(channel);
      if (channel === 'backup:previewImport') return preview132Mo();
      if (channel === 'backup:confirmImport')
        return { success: true, data: { relaunching: true, safetyBackup: 'pre-import.zip' } };
      if (channel === 'set-first-launch-complete') return { success: true };
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    await openPreview(wrapper);
    expect(document.body.textContent ?? '').toContain('54');

    confirmBtn().click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.emitted('imported')).toBeTruthy();
    const confirmIdx = order.indexOf('backup:confirmImport');
    const markIdx = order.indexOf('set-first-launch-complete');
    expect(confirmIdx, 'confirm appelé').toBeGreaterThanOrEqual(0);
    expect(markIdx, 'mark appelé après succès').toBeGreaterThanOrEqual(0);
    // Ordre critique : le bypass doit être actif pendant le confirm.
    expect(confirmIdx).toBeLessThan(markIdx);
    expect(localStorage.getItem('eschool:wizard-backup-imported')).toBeTruthy();
    wrapper.unmount();
  });

  it('confirm échec STAGING_EXPIRED → set-first-launch JAMAIS appelé, flag absent, erreur réelle affichée', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return preview132Mo();
      if (channel === 'set-first-launch-complete') return { success: true };
      if (channel === 'backup:confirmImport')
        return { success: false, error: 'STAGING_EXPIRED', message: 'Fichier de staging expiré — recommencez l’import.' };
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    await openPreview(wrapper);
    confirmBtn().click();
    await flushPromises();
    await wrapper.vm.$nextTick();

    const errors = wrapper.emitted('error');
    expect(errors).toBeTruthy();
    const msg = String(errors![0][0]);
    // Erreur backend réelle, pas de générique.
    expect(msg).toMatch(/STAGING_EXPIRED/);
    expect(msg).not.toContain('refus temporaire');
    expect(msg).not.toContain('Réservé administrateur');
    // Bypass préservé pour retry : rien marqué.
    expect(invoke.mock.calls.filter((c) => c[0] === 'set-first-launch-complete')).toHaveLength(0);
    expect(localStorage.getItem('eschool:wizard-backup-imported')).toBeNull();
    expect(wrapper.emitted('imported')).toBeFalsy();
    wrapper.unmount();
  });

  it('confirm échec SAFETY_BACKUP_FAILED → erreur réelle, aucun marquage', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return preview132Mo();
      if (channel === 'backup:confirmImport')
        return { success: false, error: 'SAFETY_BACKUP_FAILED', message: 'Sauvegarde de sécurité impossible — import annulé.' };
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    await openPreview(wrapper);
    confirmBtn().click();
    await flushPromises();
    await wrapper.vm.$nextTick();

    const msg = String(wrapper.emitted('error')![0][0]);
    expect(msg).toMatch(/SAFETY_BACKUP_FAILED/);
    expect(msg).not.toContain('refus temporaire');
    expect(invoke.mock.calls.filter((c) => c[0] === 'set-first-launch-complete')).toHaveLength(0);
    wrapper.unmount();
  });

  it('throw IPC FORBIDDEN au confirm (ancien ordre) → erreur réelle FORBIDDEN, pas "refus temporaire"', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return preview132Mo();
      if (channel === 'backup:confirmImport') throw new Error('FORBIDDEN: role undefined not allowed for backup:confirmImport');
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    await openPreview(wrapper);
    confirmBtn().click();
    await flushPromises();
    await wrapper.vm.$nextTick();

    const msg = String(wrapper.emitted('error')![0][0]);
    expect(msg).toMatch(/FORBIDDEN/);
    expect(msg).not.toContain('refus temporaire');
    expect(msg).not.toContain('Réservé administrateur');
    wrapper.unmount();
  });

  it('garde UI : case uploads non cochée → ni confirm ni set-first-launch', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport')
        return {
          success: true,
          data: {
            canceled: false,
            stagingPath: '/tmp/staging/validate-noack/database.db',
            fileName: 'b.zip',
            sourcePath: '/home/u/b.zip',
            preview: {
              kind: 'zip', dbSize: 99, tableCount: 30, userVersion: 5,
              hasUploads: false, missingUploads: true, isDowngrade: false,
              sha256: 'sha256:x', warnings: [],
            },
            warnings: [],
          },
        };
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    await openPreview(wrapper);
    const btn = confirmBtn();
    expect(btn.disabled).toBe(true);
    btn.click();
    await flushPromises();
    expect(invoke.mock.calls.filter((c) => c[0] === 'backup:confirmImport')).toHaveLength(0);
    expect(invoke.mock.calls.filter((c) => c[0] === 'set-first-launch-complete')).toHaveLength(0);
    wrapper.unmount();
  });

  it('cancel sélecteur (canceled) → cancelled émis, aucun confirm, aucun marquage', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return { success: true, data: { canceled: true } };
      return { success: true, data: [] };
    });
    const wrapper = mountCard();
    await openPreview(wrapper);
    expect(wrapper.emitted('cancelled')).toBeTruthy();
    expect(invoke.mock.calls.filter((c) => c[0] === 'backup:confirmImport')).toHaveLength(0);
    expect(invoke.mock.calls.filter((c) => c[0] === 'set-first-launch-complete')).toHaveLength(0);
    wrapper.unmount();
  });
});
