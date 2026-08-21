import { defineConfig, mergeConfig } from 'vitest/config'
import type { PluginOption } from 'vite'
import viteConfig from './vite.config'

// vite-plugin-electron-renderer remplace les builtins Node (path, fs, os,
// crypto, …) par des shims CJS incompatibles avec l'environnement jsdom de
// vitest (source des erreurs « require is not defined »). Ce plugin est ajouté
// via le plugin asynchrone `electron()` de vite.config.ts (une promesse non
// résolue au moment de l'import) : on résout d'abord tous les plugins, puis on
// retire le renderer. Les builtins sont alors résolus nativement et restent
// mockables via vi.mock('node:os', …).
export default defineConfig(async () => {
    const resolvedPlugins = (await Promise.all((viteConfig.plugins ?? []) as Array<unknown>))
        .flat()
        .filter(
            (plugin): plugin is PluginOption =>
                plugin !== null && plugin !== undefined && plugin !== false,
        );

    const plugins = resolvedPlugins.filter((plugin) => {
        if (typeof plugin !== 'object' || Array.isArray(plugin)) {
            return true;
        }
        return (plugin as { name?: string }).name !== 'vite-plugin-electron-renderer';
    });

    return mergeConfig({ ...viteConfig, plugins }, {
        test: {
            environment: 'jsdom',
            globals: true,
            css: true,
            setupFiles: ['./vitest.setup.ts'],
            coverage: {
                provider: 'v8',
                reporter: ['text', 'lcov', 'html'],
                reportsDirectory: './coverage',
                include: ['src/**/*.{ts,vue}', 'electron/**/*.{ts}'],
                exclude: [
                    '**/*.spec.ts',
                    '**/__tests__/**',
                    'src/stores/__tests__/**',
                    'electron/backend/services/__tests__/**',
                    'node_modules/**',
                    'dist/**',
                    'graphify-out/**',
                ],
                thresholds: { lines: 10, branches: 60, functions: 20, statements: 10 },
            },
            server: {
                deps: {
                    inline: ['element-plus'],
                },
            },
        },
    });
})
