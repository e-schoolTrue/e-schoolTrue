import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus, { ElMessage } from 'element-plus';
import BackupImportCard from '../BackupImportCard.vue';
import ImportBackupView from '@/views/omboarding/ImportBackupView.vue';

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useRoute: () => ({ path: '/onboarding/import-backup' }),
}));

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
    stagingPath: '/tmp/e-school/staging/validate-abc/database.db',
    fileName: 'backup-16mo.zip',
    sourcePath: '/home/user/backup-16mo.zip',
    preview: {
      kind: 'zip',
      dbSize: 16 * 1024 * 1024,
      tableCount: 55,
      userVersion: 7,
      hasUploads: true,
      sha256: 'sha256:ok16mo',
      warnings: [],
    },
    warnings: [],
  },
};

async function clickImport(wrapper: ReturnType<typeof mountCard>) {
  const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
  expect(trigger, 'bouton Importer sauvegarde').toBeTruthy();
  await trigger!.trigger('click');
  await flushPromises();
  await wrapper.vm.$nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  const invoke = ipcInvokeMock();
  invoke.mockReset();
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'set-first-launch-complete') return { success: true };
    if (channel === 'is-first-launch') return { success: true, data: true };
    return { success: true, data: [] };
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('BackupImportCard requireAdmin — bandeau Réservé administrateur', () => {
  it('interne (défaut requireAdmin=true) : FORBIDDEN → "Réservé administrateur"', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return { success: false, error: 'FORBIDDEN: backup réservé admin' };
      if (channel === 'backup:import') return { success: false, error: 'FORBIDDEN: backup réservé admin' };
      return { success: true, data: [] };
    });
    const wrapper = mountCard(); // défaut interne
    await clickImport(wrapper);
    const errors = wrapper.emitted('error');
    expect(errors).toBeTruthy();
    expect(errors![0][0]).toBe('Réservé administrateur');
    expect(ElMessage.error).toHaveBeenCalledWith('Réservé administrateur');
    wrapper.unmount();
  });

  it('onboarding (requireAdmin=false) : erreur backend réelle affichée (FORBIDDEN conservé, pas de "refus temporaire")', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return { success: false, error: 'FORBIDDEN: transient' };
      if (channel === 'backup:import') return { success: false, error: 'FORBIDDEN: transient' };
      return { success: true, data: [] };
    });
    const wrapper = mountCard({ requireAdmin: false });
    await clickImport(wrapper);
    const errors = wrapper.emitted('error');
    expect(errors).toBeTruthy();
    const msg = String(errors![0][0]);
    // Diagnostic réel : le code backend reste visible (ni expurgé ni générique).
    expect(msg).toMatch(/FORBIDDEN/i);
    expect(msg).not.toContain('refus temporaire');
    // Seul le libellé interne est proscrit en onboarding.
    expect(msg).not.toContain('Réservé administrateur');
    wrapper.unmount();
  });

  it('onboarding : preview réussi après erreur passagère → previewed émis, staging présent, aucune alerte admin', async () => {
    const invoke = ipcInvokeMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return validPreview;
      return { success: true, data: [] };
    });
    const wrapper = mountCard({ requireAdmin: false });
    await clickImport(wrapper);
    // staging présent comme sur screenshot (16 Mo / 55 tables)
    expect(wrapper.emitted('previewed')).toBeTruthy();
    expect(wrapper.emitted('previewed')![0][0]).toMatchObject({
      stagingPath: '/tmp/e-school/staging/validate-abc/database.db',
    });
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('55');
    expect(bodyText).not.toContain('Réservé administrateur');
    wrapper.unmount();
  });
});

describe('ImportBackupView onboarding — erreur réelle affichée (pas de bandeau interne)', () => {
  function mountViewRealCard() {
    return mount(ImportBackupView, {
      attachTo: document.body,
      global: {
        plugins: [ElementPlus],
        stubs: {
          Icon: { template: '<span />' },
          WizardViewBase: { template: '<div><slot /><slot name="title" /><slot name="actions" /></div>' },
        },
      },
    });
  }

  it('passe requireAdmin=false à BackupImportCard (contexte public first-launch)', () => {
    const wrapper = mountViewRealCard();
    const card = wrapper.findComponent(BackupImportCard);
    expect(card.exists()).toBe(true);
    expect(card.props('requireAdmin')).toBe(false);
    wrapper.unmount();
  });

  it('erreur FORBIDDEN affichée en inline puis preview OK (16 Mo / 55 tables) sans bandeau interne', async () => {
    const invoke = ipcInvokeMock();
    let calls = 0;
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'is-first-launch') return { success: true, data: true };
      if (channel === 'set-first-launch-complete') return { success: true };
      if (channel === 'backup:previewImport' || channel === 'backup:import') {
        calls += 1;
        if (calls === 1) return { success: false, error: 'FORBIDDEN: transient' };
        return validPreview;
      }
      return { success: true, data: [] };
    });
    const wrapper = mountViewRealCard();
    await flushPromises();
    await wrapper.vm.$nextTick();

    const clickImportInView = async () => {
      const btn = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
      expect(btn, 'bouton Importer sauvegarde dans le wizard').toBeTruthy();
      await btn!.trigger('click');
      await flushPromises();
      await wrapper.vm.$nextTick();
    };

    // 1) Erreur FORBIDDEN → affichée en inline (diagnostic réel), sans bandeau interne
    await clickImportInView();
    expect(document.body.textContent ?? '').not.toContain('Réservé administrateur');
    // L'erreur réelle est visible en inline (plus de filtrage silencieux).
    expect(wrapper.text()).toMatch(/FORBIDDEN|Échec de l'import/);

    // 2) Preview réussi (staging présent) → dialogue OK 55 tables, toujours pas de bandeau admin
    await clickImportInView();
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('55');
    expect(bodyText).not.toContain('Réservé administrateur');
    expect(wrapper.text()).not.toContain('Réservé administrateur');
    wrapper.unmount();
  });
});
