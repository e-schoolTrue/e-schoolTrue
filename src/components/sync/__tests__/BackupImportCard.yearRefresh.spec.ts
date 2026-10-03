import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { setActivePinia, createPinia } from 'pinia';
import BackupImportCard from '../BackupImportCard.vue';
import { useYearStore, PENDING_DB_REFRESH_KEY } from '@/stores/yearStore';

function ipcMock() {
  return (window as unknown as Record<string, any>).ipcRenderer.invoke as ReturnType<typeof vi.fn>;
}

function mountCard(pinia: ReturnType<typeof createPinia>) {
  return mount(BackupImportCard, {
    props: { markFirstLaunchComplete: false } as any,
    attachTo: document.body,
    global: {
      plugins: [ElementPlus, pinia],
      stubs: { Icon: { template: '<span />' } },
    },
  });
}

const preview = {
  success: true,
  data: {
    canceled: false,
    stagingPath: '/tmp/staging/validate-1/database.db',
    fileName: 'backup.zip',
    sourcePath: '/home/u/backup.zip',
    preview: {
      kind: 'zip',
      dbSize: 1024,
      tableCount: 30,
      userVersion: 7,
      hasUploads: true,
      missingUploads: false,
      isDowngrade: false,
      sha256: 'sha256:x',
      warnings: [],
    },
    warnings: [],
  },
};

let reloadMock: ReturnType<typeof vi.fn>;
let originalLocation: Location;

beforeEach(() => {
  setActivePinia(createPinia());
  document.body.innerHTML = '';
  localStorage.clear();
  vi.clearAllMocks();
  // window.location.reload direct (pas de setTimeout) — mocké pour jsdom.
  reloadMock = vi.fn();
  originalLocation = window.location;
  try {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      writable: true,
      configurable: true,
    });
  } catch {
    try {
      Object.defineProperty(window.location, 'reload', {
        value: reloadMock,
        writable: true,
        configurable: true,
      });
    } catch {
      /* best-effort */
    }
  }
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
  try {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  } catch {
    /* best-effort */
  }
});

describe('BackupImportCard — refresh années après import (fix sans-restart)', () => {
  it('confirmImport success pose flag + clear + fetchList puis reload direct (pas de setTimeout, pas de fetchCurrent orphelin)', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const invoke = ipcMock();
    // Année stale pré-import (simule Pinia + localStorage d'avant swap).
    const staleStore = useYearStore();
    staleStore.list = [{ id: 99, schoolYear: '2000-2001' } as any];
    localStorage.setItem('activeYear', JSON.stringify({ id: 99, schoolYear: '2000-2001' }));
    const fetchListSpy = vi.spyOn(staleStore, 'fetchList');
    const fetchCurrentSpy = vi.spyOn(staleStore, 'fetchCurrent');
    const initSpy = vi.spyOn(staleStore, 'init');

    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return preview;
      if (channel === 'backup:confirmImport')
        return { success: true, data: { relaunching: true, safetyBackup: 'pre-import.zip', devReload: true } };
      if (channel === 'yearRepartition:getAll')
        return { success: true, data: [{ id: 1, schoolYear: '2025-2026', isCurrent: true, status: 'active' }] };
      if (channel === 'year:getCurrent' || channel === 'yearRepartition:getCurrent')
        return { success: true, data: { id: 1, schoolYear: '2025-2026', isCurrent: true, status: 'active' } };
      if (channel === 'set-first-launch-complete') return { success: true };
      return { success: true, data: [] };
    });

    const wrapper = mountCard(pinia);
    const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
    await trigger!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const btn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Importer et redémarrer'),
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.emitted('imported')).toBeTruthy();
    // Nouveau cycle dev : flag posé AVANT clear (survit au reload).
    expect(localStorage.getItem(PENDING_DB_REFRESH_KEY)).not.toBeNull();
    // clear() purge le stale puis fetchList remplit la liste sans restart.
    expect(fetchListSpy).toHaveBeenCalled();
    expect(staleStore.list.map((y) => y.schoolYear)).toContain('2025-2026');
    // Pas de fetchCurrent orphelin : il ne persiste jamais activeYear.
    expect(fetchCurrentSpy).not.toHaveBeenCalled();
    // Reload renderer direct (pas de setTimeout 600) quand devReload.
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(initSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('sans devReload (prod) : flag + fetchList mais PAS de reload', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const invoke = ipcMock();
    const store = useYearStore();
    const fetchListSpy = vi.spyOn(store, 'fetchList');

    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'backup:previewImport') return preview;
      if (channel === 'backup:confirmImport')
        return { success: true, data: { relaunching: true, safetyBackup: 'pre-import.zip' } };
      if (channel === 'yearRepartition:getAll')
        return { success: true, data: [{ id: 2, schoolYear: '2024-2025', isCurrent: true, status: 'active' }] };
      return { success: true, data: [] };
    });

    const wrapper = mountCard(pinia);
    const trigger = wrapper.findAll('button').find((b) => b.text().includes('Importer sauvegarde'));
    await trigger!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    const btn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Importer et redémarrer'),
    ) as HTMLButtonElement;
    btn.click();
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.emitted('imported')).toBeTruthy();
    expect(fetchListSpy).toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('consommation post-reload : init(null) repersiste activeYear puis supprime le flag', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const invoke = ipcMock();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'yearRepartition:getAll')
        return { success: true, data: [{ id: 1, schoolYear: '2025-2026', isCurrent: true, status: 'active' }] };
      if (channel === 'year:getCurrent' || channel === 'yearRepartition:getCurrent')
        return { success: true, data: { id: 1, schoolYear: '2025-2026', isCurrent: true, status: 'active' } };
      return { success: true, data: [] };
    });
    localStorage.setItem(PENDING_DB_REFRESH_KEY, String(Date.now()));
    const store = useYearStore();
    // Simule App.vue onMounted / LoginView loadYears : fetchList + init(null) puis removeItem.
    await store.fetchList();
    await store.init(null);
    localStorage.removeItem(PENDING_DB_REFRESH_KEY);

    expect(store.list.map((y) => y.schoolYear)).toContain('2025-2026');
    expect(store.activeYear?.schoolYear).toBe('2025-2026');
    expect(localStorage.getItem(PENDING_DB_REFRESH_KEY)).toBeNull();
    const persisted = JSON.parse(localStorage.getItem('activeYear') ?? 'null');
    expect(persisted?.schoolYear).toBe('2025-2026');
  });
});
