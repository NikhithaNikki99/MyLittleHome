# My Little World: Project Record

Running record of decisions, completed steps, and pending work, so the project can continue across conversations.
Source of requirements: `My_Little_World_Claude_Project_Prompt.md`. The 10-screen mockup the user shared later
(5 tabs, pink gradient, italic serif titles) supersedes the prompt's 4-tab layout.

## Environment (checked 2026-11-11)
- Node 26.4.0, npm 11.17.0, JDK 21 (Temurin), Android SDK at `~/Library/Android/sdk` (platforms 35/36, build-tools 35/36, NDK 27).
- AVDs: `Pixel_7` (Android 36, Play Store image), `Pixel_9_Pro_Fold`.
- `ANDROID_HOME` / `JAVA_HOME` are not set in the shell profile; export them before building:
  `export ANDROID_HOME=$HOME/Library/Android/sdk; export JAVA_HOME=$(/usr/libexec/java_home -v 21)`
- Run on emulator: `npx expo run:android --no-bundler --device Pixel_7` (device *name*, not adb serial), with Metro started separately via `npx expo start` (do not set `CI=1`: it disables reloads and file watching).
- Reload the installed dev client: `adb shell am start -a android.intent.action.VIEW -d "mylittleworld://expo-development-client/?url=http%3A%2F%2F<host-ip>%3A8081"`.
- A native rebuild is only needed after adding a native package; JS and font-asset changes reload through Metro.
- Watchman not installed (optional). Android `cmdline-tools` not installed (not needed for Gradle builds).

## Decisions
| Decision | Why |
|---|---|
| Replaced the untouched bare RN CLI template (RN 0.88.1, TypeScript) with an Expo project | Prompt requires Expo + Expo Router + JavaScript. Old template files remain recoverable from the initial git commit. |
| Expo SDK 57 (`expo ~57.0.32`, RN 0.86.3, React 19.2.3) | Chosen by the user over SDK 58 (current npm `latest`). |
| JavaScript only; root `app/` for thin routes, `src/` for everything else | Prompt requirement. Scaffold `AGENTS.md` (TypeScript, `src/app`) deliberately not adopted. |
| `expo-router/js-tabs` instead of `expo-router`'s `Tabs` | `Tabs` from `expo-router` is marked deprecated in SDK 57; prompt forbids deprecated APIs. |
| **Five tabs: Home, Diary, Track, Planner, More**; each of Diary/Track/Planner/More is a folder with its own nested `Stack` | User's mockup. Sub-screens open inside their tab so the tab bar stays visible. `(tabs)` is not part of URLs: `/diary/new`, `/trackers/expenses`, `/profile/settings`. |
| Visual system: pink gradient background, italic serif display font (Playfair Display, bundled via `@expo-google-fonts`, works offline), rounded cards, sunset header on Home | Matches the mockup. Fonts are JS assets, so no native rebuild. |
| 4 palettes (Pink Diary default, Lavender Dreams, Matcha Journal, Creamy Teddy); every text/background pair >= 4.5:1, enforced in `theme.test.js` | Accessibility. Colours come only from `useTheme()` tokens. |
| `react-dom@19.2.3` and `expo-font@~57.0.4` as direct deps | Stops npm resolving SDK 58-era copies (`react-dom@19.3.1` ERESOLVE, duplicate `expo-font`). `expo-doctor` clean. |
| No `babel.config.js` | `babel-preset-expo` auto-adds the `react-native-worklets` plugin when installed. |
| `userInterfaceStyle: "light"` | No dark theme yet; `automatic` needs `expo-system-ui`, which is not installed. |
| Own `DatabaseGate` + singleton `getDatabase()` instead of `SQLiteProvider` | Provider renders `null` while loading and has no retry UI; the gate adds loading/error states and lets non-React services reach the DB. |
| Migrations are plain JS modules (SQL strings) run by `migrationRunner.js` | Same code runs on device and under Jest; no asset bundling of `.sql` files. Shipped migrations are never edited. |
| Schema 001-009: settings; wellness (mood/water/weight); expenses; habits; tasks; diary (entries/photos/tags); budgets + savings; sleep; goals + milestones | All screens in the mockup have their tables up front, so parallel feature work never touches migrations. |
| Money is integer paise; dates are local `YYYY-MM-DD` text, instants are ISO UTC | Prompt requirement. Month queries use half-open ranges `[start, nextMonthStart)`. |
| One mood row per local day (UNIQUE `log_date`, upsert); many water logs per day; weight "latest" = max (entry_date, created_at) | Matches how the dashboard reads them; back-dated weigh-ins never become "latest". |
| Expense categories seeded in migration 003 with fixed ids (`cat-food`...); transactions reference them `ON DELETE RESTRICT` | Stable ids across installs; a category in use cannot be deleted from under its transactions (archive instead). |
| Habits: schedule in `habit_schedule_days` (weekday 0=Sun..6), one `habit_logs` row per habit per date with `count` vs `target_count` | Supports weekly schedules and multi-count habits. |
| Data flow: screen -> hook/actions -> service (takes `db`) -> repository (parameterized SQL) -> SQLite; Zustand is only a cache | Prompt architecture rule. Screens contain no SQL. |
| Neutral wording everywhere (weight changes, budgets, missed habits, earlier tasks) | Prompt: no shaming or streak-loss guilt. |
| Daily quote: bundled list, picked deterministically from the local date | Works offline; consecutive days never repeat (tested). |
| Jest mocks `expo-crypto.randomUUID` with Node's `crypto` (`__tests__/helpers/setupJest.js`) | `jest-expo` stubs native modules so `randomUUID` returned `undefined` and every insert failed. App code still uses `expo-crypto` on device. |
| Native modules for later features installed once up front (image-picker, file-system, local-authentication, notifications, secure-store, sharing, document-picker) and the dev client rebuilt | Parallel agents cannot add native packages mid-run; one rebuild covers all of them. |

## Known caveats
- `withExclusiveTransactionAsync` runs on a separate connection and the docs note connection settings do not transfer, so `PRAGMA foreign_keys = ON` may be off inside a migration transaction. Fine so far; any migration that rebuilds tables must set it explicitly and run `PRAGMA foreign_key_check` afterwards.
- Jest database tests run on Node's `node:sqlite` (SQLite 3.54.1), not the SQLite inside expo-sqlite on Android.
- The SQLite database is **not encrypted**; do not claim otherwise.
- The emulator was sometimes changed by someone else while it was being driven with `adb input` (theme and mood changed on their own), so automated taps there are not fully reliable.
- Nothing has been committed to git yet; the working tree holds all new work.

## Milestone 1: Foundation: DONE (accepted by the user after checking on the emulator)
Verified: `expo-doctor` 21/21, Android debug build installs and launches on Pixel_7, tabs render, theme persists across app restart (read back from SQLite).

## Milestone 2: Home dashboard: DONE, redesigned to the mockup (R1-R4)
- Tested (Jest, 155 tests in 8 suites passing at the end of R4, real SQLite via `node:sqlite`): utilities, migrations 001-009 including upgrades from v1 and v5, constraints and cascades, dashboard queries, theme contrast, calendar grid, profile-name settings.
- Seen on the Pixel_7 emulator in Pink Diary: sunset header with greeting and date, quote card, four quick actions, mood row, spent/weight tiles, water bar (620 ml of 2 L), habits card with garden preview, to-dos, five-tab bar. Saved data appears on Home (an expense, a weight, a to-do, a habit, a mood, water), so those saves worked.
- Not exercised by me: habit and to-do tick-off, error states, the water ring animation (replaced by the bar).
- Home reads the profile name from settings; the name editor lives in Settings (R5).

## Milestone R5: feature screens built in parallel (IN PROGRESS)
Five agents with disjoint file ownership on the fixed schema: Diary; Expenses (overview/history/budget/savings/breakdown); Wellness + Habits; Planner (+ goals); Memories + Settings (profile, app lock, appearance, reminders, backup/restore, about). Track hub screen written by me (links to Expenses, Wellness, Habits). Results, test counts and on-device checks get recorded here at integration (R6).

### R5/R6 status (2026-11-11)
- Tested (Jest, run by me after all five agents finished): 21 suites, 440 tests passing. Android bundle compiles (Metro HTTP 200).
- Seen working on the Pixel_7 emulator: Diary tab (calendar, recent entry), Track hub, Planner Goals tab, More hub, Expenses (Overview, History, Budget, Savings, Breakdown donut), an expense saved through the Add form (Chai, 45 rupees) and shown in History, Wellness (Overview, Weight, Water, Sleep).
- Fixed in R6: Quick Add tiles showed "Entertainmen/t"; tiles now read "Fun" and "Personal" (stored names unchanged).
- Diary: the + button now opens New Entry on the day selected in the calendar (route param `date`, validated; invalid or missing means today). Tested in Jest (`blankEntry`) and seen on the emulator: selecting 5 Nov opened the entry on "Thursday, 5 November"; with no day selected it opened on today.
- **Open bug, cause not found:** in Wellness Overview and Water tabs, the headings "Water this week" and "Avg 89 ml/day" paint only part of their text ("Water this", "Avg 89 ml/"). Android lays each out as one line at full width and the views have full width, so it is not wrapping, row width, baseline alignment or font scale. Next step: render the same strings with a plain `Text` outside `AppText` to see whether the Playfair/Roboto font setup or `lineHeight` is involved.
- **Not verified on a device:** Habits, Planner Today/Week/Month, Diary New Entry and photo picking, entry detail/edit, Memories, Settings (profile name, App Lock, Appearance, Reminders, Backup/Restore, About), notifications.
- **Blocker:** the emulator is currently on the App Lock PIN screen. I did not enable it; I will not guess the PIN or clear app data. Someone needs to unlock it (or turn App Lock off in Settings) before the walkthrough can continue.

## Pending
- R6 integration: full Jest run, Android bundle, emulator walkthrough of every screen, record verified vs unverified here.
- Production build and Play Store prep (signing, icon check, privacy statement, release notes).
- Accessibility pass on device (TalkBack, large font scale).
