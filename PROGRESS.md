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
- Git: local commit `36a95c2` holds everything through R6 (nothing pushed). `android/` is generated by Expo and untracked (it is in `.gitignore`).

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
- The App Lock PIN screen that blocked the walkthrough was later unlocked. At the user's request the rest of the device walkthrough was **skipped** (2026-11-11), so the "not verified" list above still stands, and so does the clipped-text bug.

## Roadmap extension (approved 2026-11-11)
Five features, one phase at a time, each tested and accepted before the next: 1 recurring expenses, 2 flexible habit schedules, 3 monthly reflection, 4 PDF/CSV/JSON export with validated restore, 5 Android widgets. Migrations 010-012 are reserved for phases 1-3. Shipped migrations 001-009 are never edited.

### Phase 1: Recurring expenses and subscriptions (built, awaiting acceptance)
**What it does.** Expenses > Overview has a Subscriptions card (about how much a month, how many, what is next). It opens a list with pause/resume, and an add/edit form (name, amount, category, weekly/monthly/yearly, first charge date, optional end date, notes).

**Design decisions**
| Decision | Why |
|---|---|
| Each charge is a normal row in `transactions` | History, Breakdown, budgets and Home need no changes. |
| `recurring_expense_occurrences` has `UNIQUE (recurring_id, due_date)` and records `posted` or `skipped` | A charge can never be added twice, and one deleted from History does not come back (the occurrence stays, `transaction_id` becomes NULL). |
| Charges are added when the app opens the dashboard, Expenses Overview or Subscriptions (no background job) | Works offline with no native code. Charges that fell due while the app was closed are added with their real due dates when it next opens. |
| Dates are computed from the start date plus an index, never from the previous date | A monthly charge on the 31st returns to the 31st after February instead of drifting to the 28th. |
| Catch-up is serialized in one queue and runs per schedule inside one transaction | Concurrent screens cannot double-post, and a failure leaves no partial charges. |
| Pausing then resuming marks the charges that fell due meanwhile as `skipped` | They are not added later in a surprise batch. |
| Editing changes future charges only; frequency and start date are fixed after creation | History stays true, and occurrences are keyed to the schedule. |
| Deleting a schedule keeps the expenses it already added | Those are the user's records. |
| Start date limited to the last 366 days; at most 400 charges per schedule per run | Stops a typo from creating thousands of rows. |
| Both new tables added to the backup format; a backup made before this phase clears the recurring tables when it replaces transactions | Subscriptions are backed up, and a restore cannot leave occurrences pointing at transactions that no longer exist. |

**Files.** Migration `010_recurring_expenses.js`; `recurringRepository.js`; `recurrence.js` (pure schedule maths); `recurringService.js`; `SubscriptionsCard.js`, `SubscriptionsScreen.js`, `RecurringFormScreen.js`; routes `trackers/expenses/subscriptions` and `trackers/expenses/recurring`; hooks into `OverviewTab.js`, `parts.js` (navigation), `dashboardActions.js` (catch-up before each dashboard load), `backupFormat.js`, `backupRepository.js`.

**Tested (Jest, 22 suites, 472 tests passing, run after the last edit).** New `recurring.test.js` (31 tests): month-end and leap-year dates, year roll-over, weekly steps, end dates, next-due, per-month equivalents, constraints, upgrade from schema 9, category RESTRICT, back-fill, future start, repeat and concurrent catch-up (no duplicates), later catch-up, validation messages, edit affects future only, pause/resume skips, delete keeps expenses, deleted charge stays deleted, rollback on a mid-run failure, summary, backup round-trip, older backup, and a bad backup rolling back. The Android bundle compiles (Metro HTTP 200, new screens in the bundle).

**Not verified on a device.** The three new screens have not been opened on the emulator. Jest runs on Node's SQLite, not the SQLite inside expo-sqlite.

**Android verification steps**
1. Reload the app (no native rebuild needed). Open Track > Expenses > Overview and find the Subscriptions card ("Nothing repeating yet").
2. Tap it, then the + button. Add "Music plan", 119, Entertainment, Monthly, first charge today. Save. History should show one "Music plan" expense for today.
3. Add "Gym", 500, Health, Weekly, first charge 3 weeks ago. Save. History should show four Gym charges, one a week.
4. Back on Overview the card should read about the monthly total, "2 subscriptions" and the next charge. Close and reopen the app and confirm no charge is added twice.
5. Pause "Music plan" (pause icon), then resume it. Nothing extra should appear in History.
6. Open "Gym", change the amount and save. Old charges keep the old amount. Delete it and confirm its charges stay in History.
7. Delete one auto-added charge from History, reopen Subscriptions, and confirm it does not return.
8. More > Backup: create a backup, restore it, and confirm subscriptions are still listed.
9. Turn on a large font size and TalkBack and check the Subscriptions card and rows are readable and have sensible labels.

### Phase 2: Flexible habit schedules (built, awaiting acceptance)
Phase 1 was treated as accepted when the user said to continue (2026-11-11). It has still not been opened on a device.

**What it does.** The habit editor has a "How often" choice: **Days of the week** (as before), **Times a week** (1 to 6, any days, Monday to Sunday), **Every few days** (2 to 365, counted from the start date) and **Once a month** (a day from 1 to 31; the last day of shorter months).

**Design decisions**
| Decision | Why |
|---|---|
| Migration 011 only adds four columns to `habits` (`schedule_type`, `interval_days`, `weekly_target`, `month_day`); `habit_schedule_days` and `habit_logs` are untouched | Roadmap rule: preserve `habit_schedule_days` and existing logs. Existing habits become `weekdays` and behave exactly as before. |
| One CHECK ties each type to its setting (`interval` needs `interval_days`, and so on) | The database rejects an inconsistent habit, including from a bad restore. |
| Flexible habits work in windows (a Mon-Sun week, an N-day period, or one monthly date to the next) and stay on Today until the window is met | Doing it a day late still counts. Nothing is "missed" because of a busy day. |
| A "times a week" habit shows a note like "1 of 3 this week"; a late one shows "Since 6 Nov" | Tells you why it is still listed. |
| Streaks count in the schedule's own unit: days, repeats, weeks or months. An open window never breaks a streak | A weekly habit measured in days would always look broken. Matches the existing no-guilt rule. |
| The overall "days current streak" on Today only counts weekday habits | A "3 times a week" habit has no fixed days to miss. |
| "Times a week" is limited to 6 | 7 would be "every day", which Days of the week already does. |
| Switching a habit's schedule clears the settings of the old one and keeps every log | No leftovers from an earlier schedule, and history is safe. |
| Backup: the four columns are in the backup format, and a backup made before this phase restores its habits as weekday habits | Old backups still restore. |
| "Due today" moved from a SQL weekday join to `dueInfo` in `habitSchedule.js` | Whether a flexible habit is due depends on what was already done in its window. |

**Files.** `011_flexible_habit_schedules.js`; `habitSchedule.js` (pure schedule rules); `utils/ordinal.js` (shared with Phase 1); changes to `habitRepository.js`, `habitService.js`, `habitStats.js`, `habitOverview.js`, `habitOptions.js`, `backupFormat.js`; UI in `HabitSheet.js`, `TodayTab.js`, `AllHabitsTab.js`, `GardenTab.js`.

**Tested (Jest, 23 suites, 512 tests passing, run after the last edit).** New `habitSchedules.test.js` (40 tests): ordinals, exact day counts, short-month dates, due dates per type, windows (week, interval, monthly, before start), what stays on Today, streaks per unit including an open window not breaking a run, weekday streaks unchanged, overall streak and weekly progress with flexible habits, upgrade from schema 10 keeping a weekday habit and its logs, constraints, creating and editing each type, validation messages, a failed edit changing nothing, and backup round-trips including an older backup and a corrupt one that rolls back. All the original habit tests pass unchanged. The Android bundle compiles (Metro HTTP 200, no error payload). Two older tests that hard-coded the latest schema number now read it from the migration list.

**Not verified on a device.** The new habit editor options and the Today notes have not been opened on the emulator. Jest runs on Node's SQLite.

**Android verification steps**
1. Reload the app. Open Track > Habits > All, tap +. Check "How often" shows four choices and the options below change with each.
2. Create "Gym" as **Times a week: 3**. Today should list "Gym" with "0 of 3 this week". Tick it: it should show "1 of 3 this week" and stay checked today.
3. Tick it on two more days (or back-fill by editing the date on your device). After the third, it should leave Today the next day and return next Monday.
4. Create "Water plants" as **Every few days: 3**. It should stay on Today until you tick it, and after a day or two show "Since ...".
5. Create "Pay rent" as **Once a month: 31**. It should not appear on Today until the 31st (or the last day of the month).
6. Open All habits: each row should read like "3 times a week", "Every 3 days", "Monthly on the 31st", with streaks in weeks or months.
7. Open the Garden tab: a weekly habit streak should say weeks, a monthly one months.
8. Edit an old weekday habit and confirm it still shows its days and history. Switch it to "Times a week" and back, and confirm its past ticks remain.
9. More > Backup: create a backup, then restore it, and confirm the habits keep their schedules.
10. Try an invalid value (for example every 1 days) and confirm the message is clear.

### Phase 3: Monthly reflection (built, awaiting acceptance)
Phase 2 was treated as accepted when the user said to continue (2026-11-11). Phases 1 and 2 have still not been opened on a device. The roadmap only names the feature and the table (`monthly_reflections`), so the design below is mine.

**What it does.** More > Memories > **Recap** now shows a "Your reflection" card for the month being viewed. With nothing written it offers "Reflect on Nov 2026". Tapping opens a sheet with four open prompts: **What went well**, **What was hard**, **What I am grateful for**, **An intention for next month**. The saved words are shown on the card (with an edit button) beside the month's facts (entries, spending, habits, water, mood). It can be edited or deleted later.

**Design decisions**
| Decision | Why |
|---|---|
| Reflection lives in the existing Recap tab, and the month's facts come from the existing `getMonthRecap` | Reuses what is there instead of building a second monthly screen. |
| One row per month (`month_key` UNIQUE); saving again updates it and keeps the original id and created date | A month has one reflection that you can revisit. |
| Four optional prompts; at least one needs words; each up to 2000 characters | Nothing is forced. The database CHECK enforces "at least one" even for a bad restore. |
| No score, rating or grade; prompts are open and gentle (tested for judging words) | Prompt rule: no shaming or guilt wording. |
| A future month cannot be reflected on; the current month can | A month needs to have begun. |
| The table has no foreign keys | Deleting diary entries, habits or expenses never touches your words. |
| Backup includes `monthly_reflections`. A backup made before this phase clears current reflections when it replaces the diary | Restore yields exactly the backup's state, with no stale reflections left over. |
| A quiet month (nothing tracked) still shows the reflection card | You can write about a month even when you logged nothing. |

**Files.** `012_monthly_reflections.js`; `reflectionRepository.js`; `reflectionService.js`, `reflectionActions.js`, `reflectionOptions.js`; `ReflectionCard.js`, `ReflectionSheet.js`; changes to `memoriesService.js` (recap now includes `reflection`), `RecapView.js`, `MemoriesScreen.js`, `backupFormat.js`, `backupRepository.js`.

**Tested (Jest, 24 suites, 533 tests passing, run after the last edit).** New `reflection.test.js` (21 tests): table rules (one per month, month format, all-empty and whitespace-only rejected, length limit), upgrade from schema 11, independence from other tables, save and read back, trimming, a single box being enough, update keeping id and created date, separate months, current vs future month, validation messages, text at the limit, a failed edit changing nothing, prompt wording, delete, the recap carrying the reflection and still counting a month as quiet, and backup round-trip, replace, older backup and corrupt backup rolling back. The Android bundle compiles (Metro HTTP 200, no project errors).

**Not verified on a device.** The card and sheet have not been opened on the emulator. Jest runs on Node's SQLite. The keyboard behaviour of the four-box sheet on a small screen is untested.

**Android verification steps**
1. Reload the app. Open More > Memories > Recap. For this month you should see a lavender "Your reflection" card inviting you to reflect.
2. Tap it, fill in only "What went well", and save. The card should show your words under that heading only.
3. Tap the pencil, fill in the other three, save, and confirm all four show. Close and reopen the app and confirm they persist.
4. Use the month arrows. Another month shows its own invitation (or its own words). The next month after this one should show no invitation.
5. Try to save with every box empty and confirm a clear message ("Write a few words in at least one box").
6. Open the sheet with the keyboard up and scroll: every box should be reachable and the Save button visible.
7. Delete the reflection and confirm the invitation returns.
8. More > Settings > Backup: back up, then restore, and confirm reflections are still there.
9. Turn on a large font size and TalkBack and check the card is readable and each section reads as heading plus text.

### Phase 4: Export (PDF / CSV / JSON) and validated restore (built, awaiting acceptance)
Phase 3 was treated as accepted when the user said to continue (2026-11-11). Phases 1 to 3 have still not been opened on a device.

**What it does.** Settings > **Backup and restore** now makes a *complete* backup: one `.mlwbackup` file (a zip) holding all data **and the diary photos**. "Create data-only backup" keeps the old JSON file. "Restore from a file" accepts both kinds, checks the file, shows what is inside, and only then replaces your data. Settings > **Export** has **Spreadsheets (CSV)** (expenses and income, subscriptions, diary, habit check-ins, mood/water/weight/sleep, to-dos, reflections; one file each, only those with content) and **Monthly report (PDF)** (spending by category, mood, habits, water, weight, diary entries and your reflection for the chosen month).

**Native code and maintenance (flagged as the roadmap asked).**
| Item | Native? | Maintenance |
|---|---|---|
| PDF via `expo-print` ~57.0.2 | Yes, a first-party Expo SDK module, **no custom native code**. The dev client must be rebuilt once to include it. | Versioned with the SDK, so it is upgraded with `npx expo install` on each SDK change. No config plugin needed. |
| Zip via `fflate` 0.8.3 | No, pure JavaScript, no rebuild. No dependencies. | Pin and update like any npm package. |
Until the dev client is rebuilt the PDF button shows "PDF reports need the latest version of the app" and does not crash (`expo-print` is loaded lazily). CSV and backups do not need the rebuild.

**Design decisions**
| Decision | Why |
|---|---|
| The existing validated JSON format is the heart of the archive (`backup.json`); photos are `photos/p0001.jpg`... | Reuses the tested validation. Old JSON backups still restore. |
| Photo names inside the archive are generated, never copied from a path; phone file paths never enter the file | A hostile archive cannot name a location outside the photo folder. |
| **Restore order:** read and check the whole archive and stage photos, validate the JSON, check every photo record has its file, replace the database in one transaction, and only then move photos into place and remove the ones no longer used | Nothing on the phone changes until every earlier step has succeeded. A failure before the database step leaves data and photos exactly as they were. |
| Entry names must match a strict pattern; per-photo size (40 MB), photo count (5000) and total size (1.5 GB) are enforced on bytes actually received, not sizes the file claims | A zip can lie about its sizes; a zip bomb or path trick is refused. |
| Photos stream through in 256 KB chunks; nothing holds a whole photo or archive in memory | A diary with hundreds of photos must not run the phone out of memory. |
| A photo whose file is already missing is recorded as `missing:<id>` and the backup still completes | One lost file should not block a backup. The app already shows a placeholder. |
| Restored photos get new file names | A restored photo can never overwrite one in use. |
| **No PINs or secrets:** the lock flags and reminder settings are excluded from the backup (unchanged rule); the PIN lives only in secure-store; CSV and PDF read no settings at all; tests assert none of it appears | Roadmap rule. |
| CSV cells starting with `= + - @` tab or CR get a leading apostrophe; BOM + CRLF; money as plain decimal rupees | A diary title like `=HYPERLINK(...)` must not run in Excel/Sheets. |
| PDF text is HTML-escaped and the page carries a Content-Security-Policy with no scripts or network | A diary title containing markup is shown as text. |
| Backups, CSV and PDF are **not encrypted** and the screens say so | Prompt rule: no claims about encryption. |

**Files.** `features/export/`: `archiveFormat.js`, `archiveZip.js`, `archiveBackupService.js`, `csv.js`, `csvDatasets.js`, `reportHtml.js`, `reportService.js`, `exportFiles.js` (native glue), `exportActions.js`; `database/repositories/reportRepository.js`; UI `settings/sections/ExportSection.js` and a rewritten `BackupSection.js`; `SettingsScreen.js`. New dependencies: `fflate`, `expo-print`.

**Tested (Jest, 28 suites, 593 tests passing, run after the last edit).** 60 new tests: `exportArchive` (26: CSV quoting and formula protection, entry-name rules, size/count/duplicate limits, zip round-trip byte-for-byte, traversal names, truncated and random files, cleanup on failure), `exportRestore` (15: archive contents, no phone paths, missing photos, shared files, no lock/reminder data, restore puts data and photos back, inspecting changes nothing, a database failure leaves everything as it was, a photo-move failure keeps the data, damaged/hostile archives, newer-version and bad photo references, old JSON backups still restore), `exportCsv` (9: real database rows, formula text neutralised in every dataset, no settings/PIN/ids), `exportReport` (10: contents, escaping of markup, CSP, no secrets, capped lists, quiet months). Two mutation checks were run: disabling the entry-name check failed the traversal tests, and disabling the formula guard failed 4 tests; both were restored. `expo-doctor` passes 21/21 and the Android bundle compiles.

**Not verified.** The thin native layer `exportFiles.js` (file handles, `move`, `list`, picker, share sheet) has never run: Jest uses an in-memory phone. `File.open/readBytes/writeBytes/move`, `Directory.list` and `expo-print` were read from the SDK 57 typings and sources, not executed. Large-archive speed and memory on a real phone are untested. PDF layout is untested visually. The dev client has to be rebuilt before PDF can work.

**Android verification steps**
1. Rebuild the dev client once for `expo-print`: `export ANDROID_HOME=$HOME/Library/Android/sdk; export JAVA_HOME=$(/usr/libexec/java_home -v 21); npx expo run:android --no-bundler --device Pixel_7` (Metro already running). Then reload the app.
2. Add a diary entry with 2 photos and an expense. More > Settings > **Backup and restore** > **Create backup (with photos)**. The share sheet should offer a `.mlwbackup` file; save it (for example to Files or send it to yourself). The message should say the photos are included.
3. In the Files app confirm the file is a few MB, not a few KB. Open its details to confirm it is not named `.json`.
4. Delete that diary entry and its photos from the app, then **Restore from a file**, pick the `.mlwbackup`. The sheet should list the counts including "2 photos". Tap **Replace my data**. The entry and both photos should be back.
5. Try restoring a file that is not a backup (a random PDF or photo): you should get a plain message and nothing should change. Try the older data-only `.json` backup and confirm it still restores.
6. Settings > **Export** > **Spreadsheets (CSV)**: pick Expenses and open the shared file in a spreadsheet app; amounts should be like `45.50` and dates `2026-11-10`. Make a diary title `=1+1` and confirm it shows as text, not 2.
7. Settings > Export > **Monthly report (PDF)**: pick a month, **Create PDF**, open it. Check the layout, that special characters (₹, accents) look right, and that nothing like a PIN appears.
8. With the app lock on, confirm the lock still works after a restore and that none of the exported files mention it.
9. Large font and TalkBack: the Backup and Export sections should read in a sensible order.

### Phase 5: Android home-screen widgets (investigated, deliberately NOT built)
Decision (user, 2026-11-11): **skip widgets for now.** No native code, dependency or file was added. The roadmap said to explain native-code maintenance before introducing any, so the investigation and the choice are recorded here for whenever this is picked up again.

**What was checked (Expo SDK 57, RN 0.86, new architecture on).**
| Option | Finding |
|---|---|
| `expo-widgets` 57.0.28 (first-party) | **iOS only in practice.** README says "Build iOS home screen widgets and Live Activities". Its Android module is a 10-line stub with no functions, and the changelog says the Android config plugin was "temporarily made opt-in" and "stub methods" were added. Not usable for Android yet. Worth re-checking on each SDK release. |
| `react-native-android-widget` 0.26.0 (third party) | MIT, one maintainer, about 158k downloads a week, 33 Kotlin/Java files (about 4,800 lines), peer `expo >= 54`. Widgets are written in JavaScript, but each update starts the **whole React Native host in a background worker** (`HeadlessJsTaskWorker`), so the real database and the lock-screen code would run unattended. It also exports a content provider (`exported="true"`) for images. That sits badly with the roadmap's "read minimal non-sensitive summary data". |
| Small custom Kotlin widget (the recommended option) | A local Expo module (about 300 to 400 lines of Kotlin) plus a config plugin, both checked into the repo. The app would write a tiny non-sensitive snapshot (counts and the next item, no diary text, amounts only if the user opts in) to the widget, which would never open the database or the lock. A tap would use the existing `mylittleworld://` scheme. |

**Project facts that shape a future attempt**
- `android/` is generated by Expo and gitignored, so native code must live in a local Expo module (`modules/`) and a config plugin. Hand edits under `android/` would be erased by the next prebuild.
- `MainActivity` already handles the `mylittleworld://` scheme, so widget taps need no new route handling.
- Any widget means a dev-client rebuild, and the Kotlin would need re-checking at each Expo SDK and Android API upgrade (about 400 lines the project would own).
- Privacy rule if it is built: the snapshot must hold only non-sensitive summary numbers, must never include diary text, PIN or lock state, and must be cleared when App Lock is turned on or the data is restored (or the widget should show "Open My Little World" while locked).

**How to resume.** Say "build the custom Kotlin widget". The first step would be a short design for what the snapshot contains (for example today's habits done/due, water, next to-do) and which sizes to offer, before any Kotlin is written.

## Roadmap extension: status
| Phase | State |
|---|---|
| 1 Recurring expenses | Built and tested, awaiting device acceptance |
| 2 Flexible habit schedules | Built and tested, awaiting device acceptance |
| 3 Monthly reflection | Built and tested, awaiting device acceptance |
| 4 Export and validated restore | Built and tested, awaiting device acceptance; PDF needs one dev-client rebuild |
| 5 Widgets | Investigated; skipped by decision |

Final automated state: **31 suites, 649 tests passing**, `expo-doctor` 21/21, Android bundle compiles. **Not yet done on a device:** phases 1 to 4 and the earlier-listed unverified screens. The Wellness "Water this week" clipped-text bug is still open.

## App icon and splash screen (2026-11-12, seen on the Pixel_7 emulator)
History: the first set of artwork was applied twice and rejected. The user then replaced the files in `assets/` with new artwork, which is what the app uses now. The six original files remain in `Images/` (untracked) and are no longer used.

**Artwork now in `assets/` (supplied by the user):**
| File | Size | Notes |
|---|---|---|
| `icon.png` | 1254x1254 | Full-bleed picture (sky, plane, heart trail, clouds), no white canvas. |
| `android-icon-background.png` | 1254x1254 | Full-bleed sky and clouds, no grey band. |
| `android-icon-foreground.png` | 1254x1254 | The plane and heart trail. **Scaled by 0.652 and centred by me** (the supplied one reached 616 px from the centre against a 414 px safe circle, so a circular launcher clipped the plane). The user's unscaled 1254 px foreground is not in git; keep your own copy if you want to rescale it differently. |
| `android-icon-monochrome.png` | 1254x1254 | **Derived by me** from the scaled foreground's shape (white, alpha above 90, so the faint trail is left out), so the themed icon matches the normal one. |
| `splash-screen.png` | 841x1870 | Tall picture with the title and tagline; 0 edge-artifact rows or columns. |
| `splash-blank.png` | 1x1 | Fully transparent image for the native splash (made by me). |

**Splash behaviour.** Android's own splash can only show a colour and a small centred icon, so it is a plain `#1F99FA` screen (the top edge colour of the picture) with a transparent icon. `src/features/splash/SplashOverlay.js` then draws `splash-screen.png` fitted whole inside the screen (`splashLayout.js`: contain, centred, never cropped or stretched) and fades it out once fonts and the lock state are ready, after at least 1.2 s and at most 8 s. If the picture never loads, the native splash is removed after 3 s. Bands, if the screen has a different shape, are filled with the picture's top and bottom edge colours (`#1f99fa`, `#eab6e7`). On the emulator's 1080x2400 screen the picture fills the screen with under 1 dp left over.

**Checked on the emulator.** The launcher icon (circular mask) shows the whole plane and trail on the new sky; the splash fills the screen with nothing clipped; build output was verified in the installed app, not only from the build message. A run of `expo run:android` does **not** regenerate native resources from `app.json` when `android/` already exists (an earlier build "succeeded" with the old splash colour); `npx expo prebuild --platform android --no-install` has to be run first.
**Not checked.** Other phone shapes (tests cover the arithmetic only); a release build (startup is much faster than the dev build, where the native blue screen shows for about 10 s while Metro loads the bundle).

**Known.** The native splash colour shows briefly before the picture because Android always draws its own splash first. It now matches the picture's top edge, so the picture fades in over the same blue. A native screen that draws the picture itself would remove it but needs custom Kotlin.
`Images/` is untracked; the original six files in it are not used by the app.

## Home header by time of day, and nothing under the status bar (2026-11-12, seen on the emulator)
**Time of day.** The Home header scene follows the hour, using the same boundaries as the greeting (05, 12, 17, 21) so the picture never disagrees with the words: morning (pale blue and peach, low sun), afternoon (blue sky, high sun), evening (the original pink sunset), night (navy sky, stars, moon). The sun is up 05:00 to 21:00 and the moon 21:00 to 05:00, each crossing the sky left to right on one arch (`timeOfDay.js`, pure and tested). `useTimeOfDay` refreshes at the next boundary while the app is open and when it returns from the background, and the greeting uses the same clock.
**Contrast, and a test that was wrong.** The greeting and date sit over the bottom of the scene. My first contrast test blended only the sky and the page colour and said everything passed; the real screen measured 3.8:1 on the night date line because the dark hills show through the fade. The test now models the full stack (sky, both hills, then the fade) at the heights where each line sits, for all four themes and four periods, and was mutation-checked (putting the dark hills back fails exactly the four night tests). The night horizon is therefore a pale dusk glow (`#CFC6E4` sky bottom, `#A5A5CC` / `#9696C2` hills), the darkest values that pass.
**Status bar.** Android draws the app edge to edge, so content scrolled up under the clock and icons, and Home deliberately put its artwork there. `Screen` now keeps the status-bar area as an empty strip and the scroll area starts below it, on all 18 screens (it also replaces the `edgeToEdgeTop` prop, which nothing used). On Home the strip is the colour of the top of the current scene, and the status-bar icons switch to light on the dark night strip. The icon colour is only set while Home is the focused tab, so it does not carry over to other tabs (checked: at a forced 23:00 Home had navy strip and light icons, Diary had the page colour and dark icons, and going back to Home restored the navy strip).
**Not checked.** A real night (the emulator cannot change its clock; the check forced the hour for a moment and the code was removed); phones with a notch or camera cut-out taller than the status bar; the Home header on a very short screen.

## Test that depended on the date (fixed 2026-11-12)
`dashboard.test.js` "completing keeps the task visible" fixed "today" at 2026-11-11 but `toggleTask` stamps the real clock, so it failed once the real date passed midnight. It now freezes the clock to the test's day. The whole suite was then run with the clock moved by 0, 1, 40, -3 and 400 days: 597 of 597 pass each time, so there is no other hidden date dependence.

## Reminders (investigated 2026-11-12)
A reminder set for a time that had already passed today first fires the **next** day (Diary and Habits at 11:00 PM saved just before midnight were queued for 23:00 the following day; permission and the notification channel were fine). Each enabled reminder now shows "Next one: today/tomorrow" and the card says Android may deliver them a little late (the app has no exact-alarm permission, so Android may delay by up to about an hour). **Not verified:** that a reminder actually arrives; the emulator has no root so its clock cannot be moved.

## Pending
- Rebuild the dev client (adds `expo-print` for PDF and the new splash), then device acceptance of phases 1 to 4 and the new icon and splash (steps are listed under each phase).
- Regenerate `adaptive-background.png` without the grey band, if wanted.
- Confirm a real reminder is delivered.
- The open Wellness clipped-text bug and the unverified-screens walkthrough.
- Production build and Play Store prep (signing, a full-bleed 512 px store icon, privacy statement, release notes); accessibility pass on device (TalkBack, large font scale).
- Android widgets, if wanted later (see Phase 5).
