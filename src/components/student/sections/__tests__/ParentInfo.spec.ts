import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import ElementPlus from 'element-plus';
import ParentInfo from '@/components/student/sections/ParentInfo.vue';
import { unwrapParentSuggestions } from '@/types/student';

/**
 * QA — ParentInfo (Option B T_parent) :
 * - suggestions (enveloppe + tableau brut),
 * - select remplit 6 champs + badge,
 * - édition → manuelle,
 * - Dissocier vide,
 * - debounce 1 appel + garde < 2 caractères.
 */
describe('ParentInfo (autocomplete foyer)', () => {
  const suggestion = {
    id: 7,
    label: 'Moussa Diallo & Aminata Bah (+22376123456)',
    noms: 'Moussa Diallo & Aminata Bah',
    fatherFirstname: 'Moussa',
    fatherLastname: 'Diallo',
    motherFirstname: 'Aminata',
    motherLastname: 'Bah',
    famillyPhone: '+22376123456',
    address: 'Bamako',
    usageCount: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (window as unknown as { ipcRenderer?: unknown }).ipcRenderer = {
      invoke: vi.fn(async (channel: string) => {
        if (channel === 'parent:search') return { success: true, data: [suggestion], error: null, message: 'ok' };
        return { success: true, data: [], error: null, message: 'ok' };
      }),
    };
  });

  afterEach(() => {
    delete (window as unknown as { ipcRenderer?: unknown }).ipcRenderer;
  });

  const mountWithForm = () => {
    const formData = reactive<Record<string, unknown>>({
      fatherFirstname: '', fatherLastname: '', motherFirstname: '', motherLastname: '',
      famillyPhone: '', address: '', parentId: null,
    });
    const wrapper = mount(ParentInfo, {
      props: { formData },
      global: { plugins: [ElementPlus] },
    });
    return { wrapper, formData };
  };

  it('1. unwrap tolère enveloppe ET tableau brut', () => {
    expect(unwrapParentSuggestions({ success: true, data: [suggestion] })).toEqual([suggestion]);
    expect(unwrapParentSuggestions([suggestion])).toEqual([suggestion]);
    expect(unwrapParentSuggestions({ success: false, data: [] })).toEqual([]);
    expect(unwrapParentSuggestions(null)).toEqual([]);
  });

  it('2. suggestions : 1 appel IPC avec {q, limit}, garde < 2 caractères = 0 appel', async () => {
    const { wrapper } = mountWithForm();
    const vm = wrapper.vm as unknown as {
      fetchSuggestions: (q: string, cb: (items: unknown[]) => void) => Promise<void>;
    };
    const invoke = (window as unknown as { ipcRenderer: { invoke: ReturnType<typeof vi.fn> } }).ipcRenderer.invoke;

    // < 2 caractères → aucun appel.
    let got: unknown[] = [{}];
    await vm.fetchSuggestions('a', (items) => { got = items; });
    expect(got).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();

    // ≥ 2 caractères → 1 seul appel avec {q, limit}.
    await vm.fetchSuggestions('di', (items) => { got = items; });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('parent:search', { q: 'di', limit: 10 });
    expect(got).toEqual([suggestion]);
    wrapper.unmount();
  });

  it('3. select remplit les 6 champs + parentId + badge', async () => {
    const { wrapper, formData } = mountWithForm();
    const vm = wrapper.vm as unknown as { onSelect: (s: unknown) => void };
    vm.onSelect(suggestion);
    await nextTick();
    await flushPromises();
    expect(formData.fatherFirstname).toBe('Moussa');
    expect(formData.fatherLastname).toBe('Diallo');
    expect(formData.motherFirstname).toBe('Aminata');
    expect(formData.motherLastname).toBe('Bah');
    expect(formData.famillyPhone).toBe('+22376123456');
    expect(formData.address).toBe('Bamako');
    expect(formData.parentId).toBe(7);
    expect(wrapper.find('[data-testid="parent-badge"]').text()).toContain('Foyer lié #7');
    wrapper.unmount();
  });

  it('4. édition après liaison → retour manuelle (parentId=null, badge)', async () => {
    const { wrapper, formData } = mountWithForm();
    const vm = wrapper.vm as unknown as { onSelect: (s: unknown) => void };
    vm.onSelect(suggestion);
    await nextTick();
    // Simule frappe utilisateur dans Nom du père.
    const inputs = wrapper.findAll('input');
    // inputs[0] = recherche, [1] = fatherLastname.
    await inputs[1].setValue('Diallo-Modifié');
    await nextTick();
    expect(formData.parentId).toBeNull();
    expect(wrapper.find('[data-testid="parent-badge-manual"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="parent-badge-manual"]').text()).toContain('Saisie manuelle');
    wrapper.unmount();
  });

  it('5. Dissocier vide les 6 champs + parentId', async () => {
    const { wrapper, formData } = mountWithForm();
    const vm = wrapper.vm as unknown as { onSelect: (s: unknown) => void };
    vm.onSelect(suggestion);
    await nextTick();
    expect(formData.parentId).toBe(7);
    await wrapper.find('[data-testid="parent-dissociate"]').trigger('click');
    await nextTick();
    expect(formData.parentId).toBeNull();
    expect(formData.fatherFirstname).toBe('');
    expect(formData.fatherLastname).toBe('');
    expect(formData.motherFirstname).toBe('');
    expect(formData.motherLastname).toBe('');
    expect(formData.famillyPhone).toBe('');
    expect(formData.address).toBe('');
    expect(wrapper.find('[data-testid="parent-badge-manual"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('6. debounce autocomplete = 300ms (1 appel, pas de rafale)', () => {
    const { wrapper } = mountWithForm();
    const auto = wrapper.findComponent({ name: 'ElAutocomplete' });
    expect(auto.props('debounce')).toBe(300);
    wrapper.unmount();
  });

  it('7. reset externe parentId=null (resetForSibling) -> badge resynchronisé en manuelle', async () => {
    const { wrapper, formData } = mountWithForm();
    const vm = wrapper.vm as unknown as { onSelect: (s: unknown) => void };
    vm.onSelect(suggestion);
    await nextTick();
    expect(formData.parentId).toBe(7);
    expect(wrapper.find('[data-testid="parent-badge"]').exists()).toBe(true);
    // Simule student-form.vue resetForSibling : parentId:null externe.
    formData.parentId = null;
    await nextTick();
    await flushPromises();
    expect(wrapper.find('[data-testid="parent-badge-manual"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="parent-badge-manual"]').text()).toContain('Saisie manuelle');
    expect(wrapper.find('[data-testid="parent-badge"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
