# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run in browser
npx expo prebuild  # Regenerate native directories after installing native deps
```

No test suite or linter is configured yet.

## Architecture

**Stack**: Expo SDK 54 + React Native 0.81 + Expo Router 6 (file-based routing) + Zustand 5 + SQLite (expo-sqlite)

**Routing**: `app/_layout.tsx` is the root — it wraps a `<Stack>` navigator. The entry point `app/index.tsx` checks Zustand persist hydration, then redirects to `/Welcome` (onboarding) or `/RoleSelect`. After role selection, the user enters either `(child-tabs)` or `(parent-tabs)`, each a `<Tabs>` layout with separate screens.

**Role system**: Two roles — `child` and `parent`. The parent authenticates via a password stored (plaintext) in the `family` table. The role is persisted in Zustand `family-storage` and determines which tab layout is shown. `ParentLock` is a modal that prompts the password to switch from child to parent.

**Database**: Single SQLite file (`petgrowth.db`) managed via `expo-sqlite` (`src/db/database.native.ts`). All schema is created in `createTables()`. The DB has ~18 tables covering family, children, pets, tasks, behaviors, shop, AI config, chat history, etc. `src/db/database.ts` re-exports the native implementation (web fallback exists but is secondary). Key DB utilities:
- `initDatabase()` — opens DB, enables WAL + foreign keys, creates tables/indexes
- `importPresets(familyId)` — seeds preset behavior categories, rules, task templates, and shop cosmetics for a new family
- `wipeAllUserData()` — deletes all rows (keeps schema)
- `exportDatabase()` / `importDatabase()` — JSON backup with optional AES encryption (CryptoJS)

**Zustand stores** (all in `src/stores/`):
- `useFamilyStore` — persisted (SQLite on native, localStorage on web). Holds `currentFamily`, `currentRole`, `currentChild`, auth state. The single source of session identity.
- `usePetStore` — fully DB-backed. Loads pet state, handles care actions (feed/bathe/play/rest/heal/pet), calculates attribute decay, manages exp/level/evolution. Each care action deducts points/stars and updates pet attributes directly via SQL.
- `useTaskStore` — full CRUD for tasks, categories, templates. Handles task submission flow (auto-confirm vs parent/photo confirm), streak tracking with milestone rewards, daily task generation from recurring templates.
- `useShopStore` — items, purchases (with 6-digit redeem codes for gifts), pet equipment equipping/unequipping.
- `useBehaviorStore` — behavior rules/categories, point recording with daily limits and approval flow.
- `useAIStore` — AI chat with multi-provider support (Qwen/GLM/OpenAI), content filtering, fallback offline replies, prompt assembly from pet state/mood.

**Pet evolution**: Defined in `src/constants/evolution.ts`. 5 stages (egg → cub → teenager → adult → legend), mapped to levels 1-8. Level-up requires accumulating exp from task completion and streak rewards. Evolution is checked after every exp gain — `addExp()` handles overflow and triggers `justEvolved` flag.

**Path aliases**: `@/*` maps to `./src/*` (configured in tsconfig.json).

**babel-plugin-replace-import-meta.js**: Workaround for Zustand v5's `import.meta.env` usage which Metro doesn't natively support — replaces it with safe fallbacks at build time.
