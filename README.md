# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## 🔑 License Management

The app uses a fully offline Ed25519 license system:

- **1 master license** per school + **1 sub-license per station**.
- **Annual subscription** (`--years`).
- Verification is done locally against the embedded public key (`PUBLIC_KEY_HEX` in `electron/backend/services/licenseCrypto.ts`); no network required.

### Private key (vendor only)

- Stored at `.license-keys/e-school-license.key` (gitignored, permissions 600).
- Fallback location if absent from the project: `~/.e-school/e-school-license.key`.
- **Treat it as a production secret**: back it up, never commit it to git, never send it to anyone. Regenerating the keypair invalidates all previously issued licenses.

### Vendor CLI

All commands are run with `npm run license:cli -- <command>` (the `--` is mandatory with `npm run`).

```bash
# Generate the vendor keypair (idempotent; --force regenerates and invalidates issued licenses)
npm run license:cli -- gen-keypair

# Generate a master license for a school (5 stations, 1 year)
npm run license:cli -- gen-master --customer "School Name" --stations 5 --years 1 --out master.txt

# Generate a sub-license for one specific station (admin fallback; usually the school does this from the UI)
npm run license:cli -- gen-sub --master master.txt --machine <64-hex fingerprint> --years 1 --out sub.txt

# Verify a license file (pass --master for full sub-license verification)
npm run license:cli -- inspect master.txt
npm run license:cli -- inspect sub.txt --master master.txt

# Help
npm run license:cli -- help
```

### School-side activation

1. **Vendor**: generate the master license (`gen-master` above) and send `master.txt` to the school.
2. **Main station**: open **Paramètres → Sécurité → Statut de la licence et activation**, select **« Licence principale »**, paste the code, activate.
3. **Secondary stations**: each station shows its own **machine ID** (64 hex) on its activation screen. The school enters that ID on the main station via **« Générer une licence pour un autre ordinateur »** to obtain a **2-line package** (token + public key) to paste on the secondary station in **« Sous-licence »** mode.
4. **Quota**: the main station shows "X stations used out of N". Maximum is `maxStations` (1 main + N−1 secondary).

### Reminders

- A sub-license is bound to **one specific machine**; generate one per station.
- A sub-license duration cannot exceed the master license duration.
- **Renewal**: regenerate the master (`gen-master`) then regenerate the sub-licenses.
- Never share `.license-keys/e-school-license.key`.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Type Support For `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
   1. Run `Extensions: Show Built-in Extensions` from VSCode's command palette
   2. Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.
