# AGENTS.md - Guide for AI Assistants

## Project Overview

E-School Management System is a desktop application built with Vue 3, TypeScript, Electron, and various management libraries. It's an electron-based school management system with features for student, professor, and course management, along with reporting and payment tracking.

## Build, Lint, and Test Commands

### Development
```bash
npm run dev           # Start development server
npm run preview       # Preview production build
```

### Build
```bash
npm run build         # Full build: type check → Vite build → Electron builder
```

### Testing
```bash
npm run test:unit     # Run all unit tests with jsdom environment
npm run test:unit <test-name>  # Run specific test file
```

### Database
```bash
npm run rebuild:db-driver  # Rebuild better-sqlite3 native module
```

## Code Style Guidelines

### TypeScript Configuration
- **tsconfig.json**: Strict mode enabled with strict type checking
- **Target**: ES2022
- **Module**: ESNext
- **Decorators**: Enabled for class-based patterns
- **Paths**: Alias `@/` for src directory, `#electron/` for electron directory

### Vue 3 Best Practices
- **Script Setup**: Use `<script setup lang="ts">` for all Vue SFCs
- **Composition API**: Prefer Composition API over Options API
- **Type Safety**: Always include TypeScript types for props, emits, and refs
- **Auto-imports**: Vue, Pinia, Element Plus, and common composables auto-imported
- **Component naming**: PascalCase for components (e.g., `DashboardView.vue`, `CardStudent.vue`)

### File Structure
```
src/
├── components/      # Reusable UI components
├── views/           # Page-level components (routes)
├── composables/     # Reusable Vue composition functions
├── types/           # TypeScript type definitions (exported)
├── constants/       # Application constants
├── config/          # Configuration files
├── plugins/         # Vue plugins
├── routes/          # Route definitions
├── workers/         # Web workers
└── assets/          # Static assets
```

### Naming Conventions
- **Components**: PascalCase (e.g., `DashboardView.vue`, `CardStudent.vue`, `BulletinTemplateOne.vue`)
- **Files**: kebab-case for Vue files (e.g., `useCurrency.ts`), camelCase for TypeScript files
- **Functions/Variables**: camelCase (e.g., `formatCurrency`, `loadCurrency`)
- **Interfaces**: I prefix (e.g., `IStudent`, `ICourse`, `IPayment`)
- **Constants**: UPPERCASE_SNAKE_CASE (e.g., `SCHOOL_TYPE`, `TEACHING_TYPE`, `CIVILITY`)

### Code Organization
1. **Type definitions**: Export interfaces from `src/types/` directory
2. **JSDoc comments**: Include @interface, @property tags for type documentation
3. **Auto-imports**: Don't manually import commonly used libraries (Vue, Pinia, Element Plus)
4. **Electron integration**: Use `window.ipcRenderer.invoke()` for IPC communication
5. **Store patterns**: Use Pinia stores for state management

### Error Handling
- **Try-catch blocks**: Always wrap async operations in try-catch
- **Error logging**: Use `console.error()` for error reporting
- **User feedback**: Use Element Plus `ElMessage` for user notifications
- **Navigation guards**: Implement router guards for authentication

### Import Styling
- **Alias imports**: Use `@/` for src directory, `#electron/` for electron directory
- **Relative imports**: Only use relative paths when necessary
- **No unused imports**: ESLint should catch unused imports

### Type Safety Requirements
- Always define interfaces for API responses and data structures
- Use `ref<T>()` and `computed<T>()` with explicit types
- Prefer `const` over `let` for variables that don't change
- Never use `any` type; use `unknown` if type is unknown

### UI Framework (Element Plus)
- **Locale**: Always use French locale (`fr`)
- **Auto-import**: Components auto-imported via unplugin-vue-components
- **Icons**: Use @iconify/vue for icons
- **Responsive**: Follow Element Plus design system patterns

### Testing Guidelines
- **Test files**: Place in `src/components/___test___/` directory
- **Naming**: Use `*.spec.ts` extension
- **Structure**: Import testing utilities from `vitest`
- **Pattern**: Describe test suite, it test case, expect assertions
- **Isolation**: Tests should be independent and runnable in isolation

### Electron Integration
- **Main process**: Located in `electron/main.ts`
- **Preload script**: Located in `electron/preload.ts`
- **Backend services**: Located in `electron/backend/services/`
- **Type definitions**: Use `electron` types from global scope
- **Database**: TypeORM with better-sqlite3 driver

### Additional Recommendations
- Install [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) for Vue 3 support
- Disable Vetur in VS Code
- Enable TypeScript Vue Plugin (Volar)
- Enable "Take Over Mode" in Volar for better performance
- Consider adding ESLint and Prettier configuration files for consistency
- Use `vue-tsc --noEmit` before builds for type checking

## Navigation and Routing
- Hash history mode: `createWebHashHistory()`
- Route guards: Implemented in `src/routes/index.ts`
- Public routes: `/login`, `/forgot-password`, `/validate-account`, `/configuration-wizard`
- Authentication: localStorage and sessionStorage for user sessions
- Route meta: Use `meta: { requiresAuth: true }` for protected routes

## State Management
- **Pinia**: Primary state management solution
- **Stores**: Should be created in `src/stores/` (not present yet but recommended)
- **Global state**: Avoid global variables; use Pinia stores
- **Local state**: Use `ref()` and `computed()` in components

## Styling
- **CSS modules**: Not used; global CSS with scoped components
- **CSS-in-JS**: Not used; Element Plus handles most styling
- **Custom styles**: Place in component `<style scoped>` blocks
- **Auto-import**: Element Plus components auto-imported

## API Communication
- **IPC**: Main-electron renderer communication via `window.ipcRenderer.invoke()`
- **Supabase**: `@supabase/supabase-js` library available for external API
- **TypeORM**: Database ORM for SQLite backend
- **Responses**: Follow pattern `{ success: boolean, data?: T, error?: string }`

## Database
- **ORM**: TypeORM with better-sqlite3 driver
- **Migrations**: Located in `electron/migrations/`
- **Entities**: Located in `electron/backend/entities/`
- **Schema**: Defined in TypeORM entities with decorators
- **Connection**: Managed in `electron/data-source.ts`

## Best Practices Summary
1. Always use TypeScript strict mode
2. Use Composition API with `<script setup>`
3. Export types from `src/types/` directory
4. Follow naming conventions consistently
5. Wrap async operations in try-catch
6. Use Element Plus for UI components
7. Test components with Vitest
8. Maintain clean separation between frontend and electron main process
9. Use IPC for main-electron communication
10. Follow single responsibility principle

## Getting Started as New Developer
1. Review this file and project structure
2. Install recommended VS Code extensions (Volar, TypeScript)
3. Run `npm install` to install dependencies
4. Run `npm run dev` to start development server
5. Study existing components and routing patterns
6. Review `src/types/` for domain models
7. Check `electron/main.ts` for IPC patterns
8. Read test files in `src/components/___test___/` for testing examples
