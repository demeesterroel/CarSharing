# Changelog

## [1.7.0](https://github.com/demeesterroel/CarSharing/compare/v1.6.0...v1.7.0) (2026-05-09)


### ✨ New features

* **admin:** payments CRUD page at admin/payments ([#120](https://github.com/demeesterroel/CarSharing/issues/120)) ([#129](https://github.com/demeesterroel/CarSharing/issues/129)) ([7a69625](https://github.com/demeesterroel/CarSharing/commit/7a6962524e4e3892be051c2d47f9cfda47244061))
* **db:** add updated_at to payments, cars, people, settlements, settings ([#108](https://github.com/demeesterroel/CarSharing/issues/108)) ([#126](https://github.com/demeesterroel/CarSharing/issues/126)) ([64b1688](https://github.com/demeesterroel/CarSharing/commit/64b1688e25d8928ff6acc067c249f20ce7fb0f84))
* **profile:** user self-service name + bank account edit ([#117](https://github.com/demeesterroel/CarSharing/issues/117)) ([#128](https://github.com/demeesterroel/CarSharing/issues/128)) ([704f2bf](https://github.com/demeesterroel/CarSharing/commit/704f2bfdca2dca12968b4971218c4a9a8bdbae0e))


### 🐛 Bug fixes

* **settlement:** message now groups by car then type, matching card structure ([#125](https://github.com/demeesterroel/CarSharing/issues/125)) ([f607777](https://github.com/demeesterroel/CarSharing/commit/f607777e804352dfe997107856f0229affb974bc))

## [1.6.0](https://github.com/demeesterroel/CarSharing/compare/v1.5.0...v1.6.0) (2026-05-08)


### ✨ New features

* **dashboard:** owner card with per-car breakdown ([#121](https://github.com/demeesterroel/CarSharing/issues/121)) ([b185a79](https://github.com/demeesterroel/CarSharing/commit/b185a79fa2044413f118ae8946459e1cf317a6cd))
* **settlement:** unified MemberCard — replace NonOwnerMemberCard + OwnerMemberCard ([#118](https://github.com/demeesterroel/CarSharing/issues/118)) ([e220076](https://github.com/demeesterroel/CarSharing/commit/e220076f0dbd45415868efd49c3a1c6c34a4e93f))


### 🐛 Bug fixes

* **settlement:** non-owner credit card no longer collapses to slim ([#109](https://github.com/demeesterroel/CarSharing/issues/109)) ([7861650](https://github.com/demeesterroel/CarSharing/commit/7861650c6b2f97dac47153d1a91b94e13d797e8a))
* **settlement:** owner cards with payout transfer no longer collapse to slim ([#111](https://github.com/demeesterroel/CarSharing/issues/111)) ([cd2b899](https://github.com/demeesterroel/CarSharing/commit/cd2b899aae8f0ef50277872db90ed76444ee84b1))
* **settlement:** track negative payments for co-op→member credit transfers ([#113](https://github.com/demeesterroel/CarSharing/issues/113)) ([6b24a4c](https://github.com/demeesterroel/CarSharing/commit/6b24a4c857966c0cf135628879ef0d2bc5f89d29))


### 📖 Documentation

* add settlement algorithm mathematical specification ([23d2a38](https://github.com/demeesterroel/CarSharing/commit/23d2a38c3ea12e602bd2e554260f3d9772030f27))
* rewrite settlement-math.md with LaTeX math delimiters ([79a97f5](https://github.com/demeesterroel/CarSharing/commit/79a97f513c00e24d6eb703bd7055caebf852ae89))
* update settlement-math.md — step 2 uses Net(o) not S2(o) ([126bf52](https://github.com/demeesterroel/CarSharing/commit/126bf5265d2fb0cb7b7ea652e29551004254e58b))

## [1.5.0](https://github.com/demeesterroel/CarSharing/compare/v1.4.0...v1.5.0) (2026-05-05)


### ✨ New features

* **owner:** rename /admin/payout → /owner, redesign as car owner economics dashboard ([#95](https://github.com/demeesterroel/CarSharing/issues/95)) ([cd925d9](https://github.com/demeesterroel/CarSharing/commit/cd925d9b5d061bd8bc10c238531c73a979bf5f2d))
* **settlement:** integrate payments table — show settlement status and outstanding balances ([#94](https://github.com/demeesterroel/CarSharing/issues/94)) ([fb37daa](https://github.com/demeesterroel/CarSharing/commit/fb37daa0ed43a5a3bb0abfa721f45d7708379e4f))
* **settlement:** payment status, coop-POV amounts, 2-line balance bar ([#105](https://github.com/demeesterroel/CarSharing/issues/105)) ([5977906](https://github.com/demeesterroel/CarSharing/commit/59779061e1716547ca49f333ea631702069a0d27))


### 🐛 Bug fixes

* **settlement:** show step 1 & 2 section totals from coop perspective ([#104](https://github.com/demeesterroel/CarSharing/issues/104)) ([802c7fd](https://github.com/demeesterroel/CarSharing/commit/802c7fd04f64e19d1d5d31bf25a06b2c5f32d2b2))
* **settlement:** wrap page in Suspense to fix useSearchParams build error ([#106](https://github.com/demeesterroel/CarSharing/issues/106)) ([ec8a82b](https://github.com/demeesterroel/CarSharing/commit/ec8a82b9db530e6b09a226886fbfc4d1e5e692e6))

## [1.4.0](https://github.com/demeesterroel/CarSharing/compare/v1.3.1...v1.4.0) (2026-05-01)


### ✨ New features

* add 10-part implementation plan ([d9b9e5c](https://github.com/demeesterroel/CarSharing/commit/d9b9e5ccfa3289ef5a7a02ae39289b7cb769a744))
* add PersonInput and CarInput type aliases ([1670e02](https://github.com/demeesterroel/CarSharing/commit/1670e025e06cd55bd2603d890618cc8c6c32a8db))
* admin cloak-as-member ([#6](https://github.com/demeesterroel/CarSharing/issues/6)) ([#46](https://github.com/demeesterroel/CarSharing/issues/46)) ([9bb5dba](https://github.com/demeesterroel/CarSharing/commit/9bb5dba275e4bd8472411784f05494462aacb786))
* **admin-restructure:** merge Wagens + Break-even into single tab ([3daa89d](https://github.com/demeesterroel/CarSharing/commit/3daa89dbdcf3ae03a86cbabef669406112f2e6a8))
* **admin-restructure:** merge Wagens + Break-even into single tab ([3daa89d](https://github.com/demeesterroel/CarSharing/commit/3daa89dbdcf3ae03a86cbabef669406112f2e6a8))
* **admin-restructure:** merge Wagens + Break-even into single tab ([dc45d8c](https://github.com/demeesterroel/CarSharing/commit/dc45d8c8ab95135ba1fde681d5fba3819c8e7627))
* **admin/cars:** accordion car rows, no pencil ([#16](https://github.com/demeesterroel/CarSharing/issues/16)) ([#47](https://github.com/demeesterroel/CarSharing/issues/47)) ([4f66f54](https://github.com/demeesterroel/CarSharing/commit/4f66f54dabbbe76fb5e1362334556a6bc54f33bd))
* **admin/members:** accordion rows + CarBadge + consistent buttons ([#48](https://github.com/demeesterroel/CarSharing/issues/48)) ([#49](https://github.com/demeesterroel/CarSharing/issues/49)) ([38b7aed](https://github.com/demeesterroel/CarSharing/commit/38b7aed92a7f1e3942fbd623118f3476446a8e5a))
* **api:** add /api/health unauthenticated heartbeat endpoint ([16f6e88](https://github.com/demeesterroel/CarSharing/commit/16f6e889fa5b7a6cc50a6cd533b51cad7103692a))
* app shell with providers and layout ([5394170](https://github.com/demeesterroel/CarSharing/commit/53941701643d03472c486f7ec55e1c7395fe51a0))
* **auth:** hash-password script for generating AUTH_PASSWORD_HASH ([03da578](https://github.com/demeesterroel/CarSharing/commit/03da5786f28e13e2c512a15393d37b365daa2c39))
* **auth:** install iron-session + bcryptjs, add i18n keys, document env vars ([14c3362](https://github.com/demeesterroel/CarSharing/commit/14c3362dc0942cf6d470657d2325edc520c006ca))
* **auth:** login API route with timing-safe credential check ([429bda0](https://github.com/demeesterroel/CarSharing/commit/429bda0fdc8ce4eb4c2aff80b8af8366fb5f5405))
* **auth:** login page with inline error and redirect on success ([2840419](https://github.com/demeesterroel/CarSharing/commit/2840419aa4d5e6fb140711584953201e57156a10))
* **auth:** logout API route ([2504fca](https://github.com/demeesterroel/CarSharing/commit/2504fcab2dbe0b6e927d4926d855a09a955a9d57))
* **auth:** logout button in nav drawer ([cb5609d](https://github.com/demeesterroel/CarSharing/commit/cb5609daa5e1d1e9ee3bcd2f12fe5ab6915280ff))
* **auth:** middleware redirects unauthenticated requests to /login ([fab4570](https://github.com/demeesterroel/CarSharing/commit/fab457063643b32fa0aa3c3f9b5dc939347ac8c8))
* **auth:** per-person credentials, roles, and invite flow ([f377d34](https://github.com/demeesterroel/CarSharing/commit/f377d34853d778643160f6fef89afa41761cb120))
* **auth:** per-person credentials, roles, and invite flow ([f377d34](https://github.com/demeesterroel/CarSharing/commit/f377d34853d778643160f6fef89afa41761cb120))
* **auth:** per-person credentials, roles, and invite flow ([63077fb](https://github.com/demeesterroel/CarSharing/commit/63077fba8f39a4ce5ca85f0abc30af85599c5727))
* **auth:** session options module and timing-safe credential helper with tests ([599bc27](https://github.com/demeesterroel/CarSharing/commit/599bc27b4410e50be6bd31cf0e81a2c3a94a09e7))
* calendar page with FullCalendar and inclusive end-date rendering ([0d34e45](https://github.com/demeesterroel/CarSharing/commit/0d34e45a078d24db62a0fda6c152d09e5dbb3903))
* **calendar:** self-contained PickCalendar with nav, stable layout, and role-aware submit ([dcbfaf4](https://github.com/demeesterroel/CarSharing/commit/dcbfaf40f608a97fe6db358deae1bf25d8f2af41))
* car last-state query, API route, and hook ([6e481ec](https://github.com/demeesterroel/CarSharing/commit/6e481ecd27c4a6265fc7284285ae061f1b652274))
* car toggle button group component ([3865079](https://github.com/demeesterroel/CarSharing/commit/3865079a1079aa828ba3186c6ce4dd9471511b79))
* cars API routes with zod validation ([fdf17ff](https://github.com/demeesterroel/CarSharing/commit/fdf17ffdf6faeeef592d643e94173195e0e5de92))
* cars list and add/edit form ([3bf11eb](https://github.com/demeesterroel/CarSharing/commit/3bf11eb4cebe0f7c310abf3b84170ac4acd357b4))
* createResourceHooks factory for CRUD hooks ([146286b](https://github.com/demeesterroel/CarSharing/commit/146286b0b9094ab2b8ea226bc2dd4e425974104b))
* dashboard API route ([65a3f8d](https://github.com/demeesterroel/CarSharing/commit/65a3f8dd394286422cf57ff4cdd3f90bccf6e82e))
* dashboard page with per-person balance and year navigation ([af4156c](https://github.com/demeesterroel/CarSharing/commit/af4156c7ddd56b5185c8edb63999e28045eca3cd))
* dashboard query aggregates in 4 GROUP BY passes with tests ([80e3bdc](https://github.com/demeesterroel/CarSharing/commit/80e3bdca9c0cab61baad0544846879d63ae46790))
* **dashboard:** add expense_count to DashboardRow ([c1188ba](https://github.com/demeesterroel/CarSharing/commit/c1188ba8dff80debbcf1c7e6f6c8550d6e66b884))
* **dashboard:** add hover highlight on clickable receipt rows ([4921812](https://github.com/demeesterroel/CarSharing/commit/4921812eece7c67372be0922531fc8c85a23dcea))
* **dashboard:** receipt-style activity summary with clickable lines ([eabfeb5](https://github.com/demeesterroel/CarSharing/commit/eabfeb5753a86d8f43b6463f7728329349da2aea))
* **dashboard:** year navigation with dynamic earliest-year bound ([e3a3eb4](https://github.com/demeesterroel/CarSharing/commit/e3a3eb458c71a97b9c4cc3f7e1e64a120baf61fe))
* **db:** replace ad-hoc schema with versioned SQL migrations ([5c99670](https://github.com/demeesterroel/CarSharing/commit/5c99670207261e8cfcd39687a10ce5492aeb7ed8))
* deep linking — URL-synced filters, tabs, and modals ([e90e03e](https://github.com/demeesterroel/CarSharing/commit/e90e03e6b7a480de1de0178d1ae18dbbd8032bdd))
* **deps:** upgrade Next.js 15 → 16.2.4 with webpack mode for PWA ([#81](https://github.com/demeesterroel/CarSharing/issues/81)) ([4ffeaad](https://github.com/demeesterroel/CarSharing/commit/4ffeaad2462b334c740defaab3a02220ede62688))
* **docs:** add /docs page with Swagger UI rendered from local npm package ([17fa6a8](https://github.com/demeesterroel/CarSharing/commit/17fa6a8402eeaec801ec1ebf16c245d43299a613))
* domain types with english field names ([d917ccf](https://github.com/demeesterroel/CarSharing/commit/d917ccfabd0c527acc9ae186cf7fc35b331f78c8))
* **e2e:** add CRUD and reservation approval E2E tests ([#60](https://github.com/demeesterroel/CarSharing/issues/60)) ([#79](https://github.com/demeesterroel/CarSharing/issues/79)) ([43a77be](https://github.com/demeesterroel/CarSharing/commit/43a77beb3cba9d52cdabbebfd421cc72925eac7b))
* english naming throughout, seed script from exported data, naming reference ([a6f7aa0](https://github.com/demeesterroel/CarSharing/commit/a6f7aa03cb7b8e0bbc30b19c2f98b4eb12f703d0))
* expense query helpers ([83e374b](https://github.com/demeesterroel/CarSharing/commit/83e374bf678f90426b49ccc5d9d90373bca71494))
* expenses API routes with zod validation ([4fb30b8](https://github.com/demeesterroel/CarSharing/commit/4fb30b8bfe1a5b56420c1532ddd8f3020689dc6c))
* expenses page with grouped list ([7163cc5](https://github.com/demeesterroel/CarSharing/commit/7163cc547230f7edaa57e36ce6e839e5accf9c70))
* **fixed-costs:** replace 4-field schema with line-item array ([cb6d08f](https://github.com/demeesterroel/CarSharing/commit/cb6d08fd5898956e03a79414d17f706027e7c3a3))
* **fixed-costs:** replace 4-field schema with line-item array ([cb6d08f](https://github.com/demeesterroel/CarSharing/commit/cb6d08fd5898956e03a79414d17f706027e7c3a3))
* **fixed-costs:** replace 4-field schema with line-item array ([2bc4ca2](https://github.com/demeesterroel/CarSharing/commit/2bc4ca24867145871310a444b3f788f829884ff7))
* fuel fill-up API routes with zod validation ([019a285](https://github.com/demeesterroel/CarSharing/commit/019a285125077a60ab0fe3950923aed446600f53))
* fuel fill-up query helpers ([abefa9a](https://github.com/demeesterroel/CarSharing/commit/abefa9a4222fded8b79790e10fe55a4551ec1c4d))
* fuel page with receipt upload and auto price-per-liter ([2880d84](https://github.com/demeesterroel/CarSharing/commit/2880d8485c79983deb41d7d1047db72b4382ddc5))
* grouped list component with month headers and totals ([15b63b5](https://github.com/demeesterroel/CarSharing/commit/15b63b5a3e908860fb5e584a23b9a6b68e2c4083))
* **hygiene:** click gap to assign person — creates gap-filling trip ([2e4c6d4](https://github.com/demeesterroel/CarSharing/commit/2e4c6d420448e4f970a320094f8329f835e18865))
* i18n, paper theme, fleet economics, auth, reservations, admin ([991c446](https://github.com/demeesterroel/CarSharing/commit/991c446b396ad8d105bd375ee3175a04796a5fda))
* **i18n:** dutch message dictionary ([c046829](https://github.com/demeesterroel/CarSharing/commit/c046829692d780c966b94fa1802317fa14165047))
* **i18n:** replace all hardcoded inline strings with t() calls; fix Scalar docs route ([61e842d](https://github.com/demeesterroel/CarSharing/commit/61e842debdf651751a0e33e7de435ff0399fdd7b))
* **i18n:** t() helper with typed keys and {param} substitution ([bbf9e58](https://github.com/demeesterroel/CarSharing/commit/bbf9e58ae080bfad442339e4d8c2547655540fcb))
* individual resource hooks using createResourceHooks factory ([a1c8111](https://github.com/demeesterroel/CarSharing/commit/a1c81118c726ad58a674219bcea3fe7408bd5761))
* json/readBody/readId api helpers with tests ([2c08700](https://github.com/demeesterroel/CarSharing/commit/2c087001773b919e60da82c8bc42dab978001d05))
* **mine-filter:** All/Mine filter on trips, fuel, expenses ([b7607f5](https://github.com/demeesterroel/CarSharing/commit/b7607f54c566360845d2a65db255e7f5d60c0523))
* **mine-filter:** All/Mine filter toggle on trips, fuel, expenses ([b7607f5](https://github.com/demeesterroel/CarSharing/commit/b7607f54c566360845d2a65db255e7f5d60c0523))
* **mine-filter:** All/Mine filter toggle on trips, fuel, expenses ([d167512](https://github.com/demeesterroel/CarSharing/commit/d167512da9507ee13ec3ada72ead055df3028b4d))
* multi-stage dockerfile with native module compile in builder ([de5247f](https://github.com/demeesterroel/CarSharing/commit/de5247f4aa1f7ff5e3ab20c8faa26bfe68d4962c))
* nav drawer and page header ([efb794f](https://github.com/demeesterroel/CarSharing/commit/efb794f58b9c02ce8eac6d0b9ef1ee962ff4e2aa))
* **offline:** boot-time prewarm of critical API endpoints ([e5a9982](https://github.com/demeesterroel/CarSharing/commit/e5a9982e63ac15b22b7b501b63fffeeb39226c94))
* **offline:** disable add/save actions when offline ([c9791c5](https://github.com/demeesterroel/CarSharing/commit/c9791c5a394889289eba287da84a218797e61806))
* **offline:** header badge with fresh/stale states ([4b19104](https://github.com/demeesterroel/CarSharing/commit/4b19104baa69a61b8290599bf2e19cd6938ce2e8))
* **offline:** online-state context with heartbeat and staleness ([03a5184](https://github.com/demeesterroel/CarSharing/commit/03a518402d9964d46b4a85226159dc9d20c560b0))
* **offline:** Phase 1 — read-only offline support with SW caching & status indicator ([7f26fed](https://github.com/demeesterroel/CarSharing/commit/7f26fed837cc2ca2d0f513d87bbfd30209a5316e))
* **offline:** refetch lastCarState on trip form open + offline hint ([18cbcc8](https://github.com/demeesterroel/CarSharing/commit/18cbcc8d9c7e63d6ee6eca86b79eee02a79df3dc))
* **offline:** refetch reservations on new-reservation sheet open ([b631ebb](https://github.com/demeesterroel/CarSharing/commit/b631ebb460bfd47725d4553b82367aa5193e51cb))
* **offline:** show OfflineBadge in every page header ([f7e48a9](https://github.com/demeesterroel/CarSharing/commit/f7e48a94bcd208e708170d219b67ea9805d8dacf))
* **offline:** trigger boot-time prewarm after auth resolved ([d39c0ec](https://github.com/demeesterroel/CarSharing/commit/d39c0ec08fe6a07715e183f54cd4742011297280))
* **offline:** wire OnlineStateProvider into app shell ([1e94957](https://github.com/demeesterroel/CarSharing/commit/1e94957d33f2a8588c878bcc1a2df37aefed2919))
* **owner:** filter admin inbox and data hygiene to owner's cars only ([#69](https://github.com/demeesterroel/CarSharing/issues/69)) ([#71](https://github.com/demeesterroel/CarSharing/issues/71)) ([960b39a](https://github.com/demeesterroel/CarSharing/commit/960b39a184692204c452f1fac0ab556e711e450a))
* paper theme, receipt redesign, reservation UX overhaul ([c905883](https://github.com/demeesterroel/CarSharing/commit/c9058832f30c4d08cd154dc0fc1a661c3ac4f9a0))
* payment query helpers ([6972ba9](https://github.com/demeesterroel/CarSharing/commit/6972ba9f49b2a8b59ff5e6f9657057de6aeb9f45))
* payments API routes with zod validation ([6d65e5d](https://github.com/demeesterroel/CarSharing/commit/6d65e5d735654783211577aae2be0129073316db))
* payments page ([e130d1b](https://github.com/demeesterroel/CarSharing/commit/e130d1b78cf1ee4e3025d3c3fec2af0f41c218ce))
* people and cars query helpers with tests ([d149b25](https://github.com/demeesterroel/CarSharing/commit/d149b25f2bbf6efa5e587f47ce722bf14478a45d))
* people API routes with zod validation and error wrapper ([4f8c5c5](https://github.com/demeesterroel/CarSharing/commit/4f8c5c5a4aa761b86381fa66048615827273fae9))
* people list and add/edit form ([c35eac7](https://github.com/demeesterroel/CarSharing/commit/c35eac7836d91e24cbcc4f58db1bec4d6cdd1052))
* persistent bottom tab bar for trips and fuel ([8515899](https://github.com/demeesterroel/CarSharing/commit/851589981afc7fcf54a1ec1ff92e44a5e831d159))
* person select and floating action button ([9a68060](https://github.com/demeesterroel/CarSharing/commit/9a68060c96492b75fc63e7de46193488bbb1e256))
* Phase 4 — UX improvements (error boundaries, optimistic updates, offline queue) ([#56](https://github.com/demeesterroel/CarSharing/issues/56)) ([5b5839c](https://github.com/demeesterroel/CarSharing/commit/5b5839c75fb2be65fdcda6b7da4b2dd44d458f1c))
* Phase 6 — JSDoc, OpenAPI spec, accessibility fixes, and version in header ([#59](https://github.com/demeesterroel/CarSharing/issues/59)) ([c985ecb](https://github.com/demeesterroel/CarSharing/commit/c985ecba58a88cad97ec12970f951b9bf54cc157))
* PWA manifest and icons ([20e3f48](https://github.com/demeesterroel/CarSharing/commit/20e3f48cb766f9cf5b3c886b37e6839228cd02ea))
* PWA service worker via @ducanh2912/next-pwa ([32be72f](https://github.com/demeesterroel/CarSharing/commit/32be72f13fb638aa94f5778ce6de745d1d3b4c4a))
* **pwa:** apple-touch-icon 180px, appleWebApp title AutoDelen, align theme-color ([09bf21d](https://github.com/demeesterroel/CarSharing/commit/09bf21d5ab91ef8737f777b6292654f6b063b3f0))
* **pwa:** explicit runtime caching with StaleWhileRevalidate for data APIs ([1062e4d](https://github.com/demeesterroel/CarSharing/commit/1062e4d50b67a825549a8898724e0dc0bfd4ea78))
* **pwa:** generate people+car icons in all required sizes ([607ab9f](https://github.com/demeesterroel/CarSharing/commit/607ab9fdf62c717119557b9434485f7d36db767a))
* **pwa:** update manifest — AutoDelen name, paper/ink colours, maskable icon ([6cda958](https://github.com/demeesterroel/CarSharing/commit/6cda9583dc39c2b502627895e355656c96d9f209))
* receipt-upload component ([03dd5ae](https://github.com/demeesterroel/CarSharing/commit/03dd5ae7077c4bacee029d445d2be0bcf5c3f1c5))
* reservation query helpers ([086d669](https://github.com/demeesterroel/CarSharing/commit/086d6690ff542f9c31b5bf0051e7270ef80edc34))
* reservations API routes with zod validation ([ecff9e6](https://github.com/demeesterroel/CarSharing/commit/ecff9e6f7e893dd2691894210a48bd332a20f821))
* **reservations:** replace FullCalendar with 14-day per-car timeline ([4b2bda6](https://github.com/demeesterroel/CarSharing/commit/4b2bda624a199c8c3b4727827a0bd508f75635a3))
* **reservations:** replace FullCalendar with 14-day per-car timeline ([4b2bda6](https://github.com/demeesterroel/CarSharing/commit/4b2bda624a199c8c3b4727827a0bd508f75635a3))
* **reservations:** replace FullCalendar with 14-day per-car timeline ([5e098f9](https://github.com/demeesterroel/CarSharing/commit/5e098f940a8e17f258a0eb258889e803ff85de36))
* **routing:** add useQueryParam hook for URL-synced filter state ([270e243](https://github.com/demeesterroel/CarSharing/commit/270e243ac5c17fcb158463bd15a856cc7f4a6468))
* **routing:** sync admin sub-tab to ?tab= URL param ([c5b29d0](https://github.com/demeesterroel/CarSharing/commit/c5b29d0e25c20c4f48942d9ef34a2188ecf946d8))
* **routing:** sync calendar modals to URL params ([8309b44](https://github.com/demeesterroel/CarSharing/commit/8309b44ea51a99a60c2d3d20972d58d9b5e35502))
* **routing:** sync expenses filters and modals to URL params ([8d6fb00](https://github.com/demeesterroel/CarSharing/commit/8d6fb00146075c438fbb3c09a8f85a0a605c7446))
* **routing:** sync fuel filters and modals to URL params ([660b493](https://github.com/demeesterroel/CarSharing/commit/660b493fe0959de1305acf8b232f8465587f9926))
* **routing:** sync trips filters and modals to URL params ([1104095](https://github.com/demeesterroel/CarSharing/commit/11040950c6dc176d10846337999f5d3f1c9bef8d))
* **scripts:** generate-invite — create invite link for a person by name ([df1bf4e](https://github.com/demeesterroel/CarSharing/commit/df1bf4e755d6b2faaf647bbacaa5cb0000aac190))
* seed script from exported google sheets data ([469778f](https://github.com/demeesterroel/CarSharing/commit/469778f30d47693b3838210e7f53245819226fd6))
* **settlement:** annual owner payout settlement ([#7](https://github.com/demeesterroel/CarSharing/issues/7)) ([#82](https://github.com/demeesterroel/CarSharing/issues/82)) ([88534d6](https://github.com/demeesterroel/CarSharing/commit/88534d6c9afeff71cc3c186e41042c607196bc1b))
* sqlite connection singleton and english schema ([6ebcb3d](https://github.com/demeesterroel/CarSharing/commit/6ebcb3d35f88bf990ddf4084da8cf10d262ba685))
* TanStack Query hooks for people and cars ([021c474](https://github.com/demeesterroel/CarSharing/commit/021c47430eb2746203f3a84cf8ed0e5d7abb5639))
* trip amount and payment year formulas with tests ([fafdc76](https://github.com/demeesterroel/CarSharing/commit/fafdc7689d6f1dce2e1ab918d0df627746b05496))
* trips API routes with zod validation ([74e1bbd](https://github.com/demeesterroel/CarSharing/commit/74e1bbdc76757b7c17df82136ea63f9e54eb8404))
* trips hook and GPS location picker ([ed79a37](https://github.com/demeesterroel/CarSharing/commit/ed79a375056d5bfbd28d303e7cc01030dcbb9972))
* trips list page, form with GPS and auto-calculation ([f996b44](https://github.com/demeesterroel/CarSharing/commit/f996b445c46de35ea855607168aff1d18da90f24))
* trips query helpers with amount calculation ([e70e06f](https://github.com/demeesterroel/CarSharing/commit/e70e06f48e6d2c0c6057053952bac0438ed3c3aa))
* **ui:** replace native select with custom paper-styled year dropdown ([714d35a](https://github.com/demeesterroel/CarSharing/commit/714d35ad0e277bfa9e1a55e84646762205bbcd8f))
* **ui:** replace year toggle buttons with right-aligned dropdown ([642ca9f](https://github.com/demeesterroel/CarSharing/commit/642ca9f75e98a41e6ffb90bdc70af4920af4423f))
* upload route with size/mime validation and static serving ([046a0b2](https://github.com/demeesterroel/CarSharing/commit/046a0b26b54784560901c5747794f2ec42e30399))
* useFuelFillups hooks ([e875cd6](https://github.com/demeesterroel/CarSharing/commit/e875cd692771ced342e3d43a5eda183c8c844bbf))
* **ux:** add language switcher to login screen ([#74](https://github.com/demeesterroel/CarSharing/issues/74)) ([#75](https://github.com/demeesterroel/CarSharing/issues/75)) ([fb087d0](https://github.com/demeesterroel/CarSharing/commit/fb087d02cc17bced2f90c5c8c106d3b140e4a5e4))
* **ux:** apply paper design to login screen ([#50](https://github.com/demeesterroel/CarSharing/issues/50)) ([#62](https://github.com/demeesterroel/CarSharing/issues/62)) ([5472ddb](https://github.com/demeesterroel/CarSharing/commit/5472ddb4d77c23eb07ec9d0bf00c558b200be8f6))


### 🐛 Bug fixes

* **a11y:** allow pinch-zoom by raising maximum-scale from 1 to 5 ([4a7a1a1](https://github.com/demeesterroel/CarSharing/commit/4a7a1a1514e3340f0f46d70a7f8427a32501ed6c))
* add onError toasts, payment amount positive validation ([eb590b8](https://github.com/demeesterroel/CarSharing/commit/eb590b896c8d0061038187f9ec40dc72f1b0ae16))
* **admin/cars:** replace free-text owner field with people dropdown ([a3802cb](https://github.com/demeesterroel/CarSharing/commit/a3802cb961ee51daa69613bb2263309983887ed9))
* **admin:** include CSRF token when generating invite link ([#61](https://github.com/demeesterroel/CarSharing/issues/61)) ([#65](https://github.com/demeesterroel/CarSharing/issues/65)) ([55920ab](https://github.com/demeesterroel/CarSharing/commit/55920abfd331e6b4bf0ebad827ebdd944fcdd5a0))
* **auth:** only destroy session if authenticated in logout route ([31ce832](https://github.com/demeesterroel/CarSharing/commit/31ce832a177de356ee05081d5dec1d99ae6eaef4))
* **auth:** owners can only access their allowed admin pages ([#63](https://github.com/demeesterroel/CarSharing/issues/63)) ([#68](https://github.com/demeesterroel/CarSharing/issues/68)) ([964774d](https://github.com/demeesterroel/CarSharing/commit/964774dec4390fba3ab6a930ae15401ed8f197d4))
* **auth:** remove uploads from middleware bypass — receipt images require authentication ([0a19145](https://github.com/demeesterroel/CarSharing/commit/0a19145944f8af46feaf7d233d1df709c6823481))
* **build:** add SessionData type to requireAdmin for TypeScript compatibility ([e25c704](https://github.com/demeesterroel/CarSharing/commit/e25c7045595337db975c2e972658fba3f7d2f485))
* **build:** clean up Next.js 16 build warnings ([#84](https://github.com/demeesterroel/CarSharing/issues/84)) ([eae7238](https://github.com/demeesterroel/CarSharing/commit/eae72382954c018912fe6055795b5be00c3016da))
* **build:** remove SESSION_PASSWORD placeholder from Dockerfile; add versioned Docker tags on release ([7341836](https://github.com/demeesterroel/CarSharing/commit/73418365e33df64f96f3e8dd9de82ea17d056d34))
* **build:** use --webpack flag for Next.js 16 compatibility with next-pwa ([a4b1e05](https://github.com/demeesterroel/CarSharing/commit/a4b1e054bfeb80f6b4bba038007f4805a8139eb7))
* **calendar:** allow selecting boundary days of existing reservations ([8b8f5de](https://github.com/demeesterroel/CarSharing/commit/8b8f5de4051cd16655fe7c95d9a951ce37cf7d2b))
* **ci:** use PAT for release-please so its PRs trigger the quality CI check ([5a20923](https://github.com/demeesterroel/CarSharing/commit/5a2092311a2b7d22f0fc7a58530fbad76a1d8aa1))
* complete useEffect dependency arrays in trip and fuel forms ([d016c50](https://github.com/demeesterroel/CarSharing/commit/d016c501750bd039fd3b0c55d2f651d13a120f67))
* **config:** set outputFileTracingRoot to silence Next.js 16 lockfile warning ([6790a64](https://github.com/demeesterroel/CarSharing/commit/6790a6485a458d580376a2b3255de16971b9b374))
* create uploads dir on first upload, harden path traversal guard ([706ec8c](https://github.com/demeesterroel/CarSharing/commit/706ec8ceb2bba598b64b2f836ddffbfa01eaf20a))
* **dashboard:** defer toLocaleDateString to client to prevent SSR hydration mismatch ([91eaa9d](https://github.com/demeesterroel/CarSharing/commit/91eaa9d300eb27c320281f2443b609bb03734f11))
* **dashboard:** guard paid_amount sign in receipt display ([ce0d588](https://github.com/demeesterroel/CarSharing/commit/ce0d588eb3c898201f2a2d599f39d194d9733269))
* **db:** disable FK checks during migrations and update test/seed imports ([cbcaa8b](https://github.com/demeesterroel/CarSharing/commit/cbcaa8b1367d5ce601d0f7c9e508130a7577c87f))
* **docker:** add python3/make/g++ to builder for better-sqlite3 fallback ([4defb55](https://github.com/demeesterroel/CarSharing/commit/4defb556f54855c41cf952365fc241d0d1755cac))
* **docker:** provide SESSION_PASSWORD placeholder for next build ([b2fced6](https://github.com/demeesterroel/CarSharing/commit/b2fced61d92043d7f1efc22bb3502d69a08ee1ba))
* **env:** lazy-validate env at first access, not at import time ([a06d6c4](https://github.com/demeesterroel/CarSharing/commit/a06d6c4a456b6fb7cc56ec8f8e8bf002ec42327b))
* **env:** remove process.cwd() — not available in edge runtime ([58a06b2](https://github.com/demeesterroel/CarSharing/commit/58a06b2889f8229c8a0315ecdf5e9b0e5ae4b680))
* exclude pwa service worker artifacts from docker build context ([032e977](https://github.com/demeesterroel/CarSharing/commit/032e977b704060c5925eef962f406c1c11164894))
* **lint:** exclude .worktrees from ESLint to prevent scanning generated .next build files ([6c31bc9](https://github.com/demeesterroel/CarSharing/commit/6c31bc9e08347372966212ec71598727c387a489))
* **members:** use apiFetch for savePerson and handleCloak to include CSRF token ([#77](https://github.com/demeesterroel/CarSharing/issues/77)) ([e8d9c78](https://github.com/demeesterroel/CarSharing/commit/e8d9c785643328623a0ffbcfe2f5202b56977586))
* **middleware:** add /api/docs to PUBLIC_PATHS so spec is accessible without login ([4dbebcd](https://github.com/demeesterroel/CarSharing/commit/4dbebcd01166255b8ba0151131c74faebef8e3cd))
* nav drawer accessibility and grouped list react keys ([8b504e7](https://github.com/demeesterroel/CarSharing/commit/8b504e785c23f419bcb2fe248f994b5729c565a8))
* **nav:** remove redundant exit-cloak button from bottom tab bar ([#64](https://github.com/demeesterroel/CarSharing/issues/64)) ([6959a24](https://github.com/demeesterroel/CarSharing/commit/6959a24badf39f020ac1d843cf6f5ba84f81d6c8))
* NextResponse for 201, active checkbox, empty string to null for car fields ([bccb07f](https://github.com/demeesterroel/CarSharing/commit/bccb07fa7045ba9e1c5e43a82c91257d497af8ad))
* **offline:** badge recovery + RSC cache ignores search params ([89bb3d7](https://github.com/demeesterroel/CarSharing/commit/89bb3d78b81ade4cf3da7835226a345c49366b2c))
* **offline:** block /admin navigation when offline ([4bce14c](https://github.com/demeesterroel/CarSharing/commit/4bce14cdbb73f7f015df2d902e5b7bf24cfda249))
* **offline:** correct fuel query key + merge RSC caches ([6de0024](https://github.com/demeesterroel/CarSharing/commit/6de00249496abeb70d8736b26930eed722f16c17))
* **offline:** intercept form submit at &lt;form&gt; level instead of button type ([17e5104](https://github.com/demeesterroel/CarSharing/commit/17e51048965d889dfc93f8456c56f3fe26b9c0a1))
* **owner:** apply owner car filter to inbox pending count in subnav ([#69](https://github.com/demeesterroel/CarSharing/issues/69)) ([#73](https://github.com/demeesterroel/CarSharing/issues/73)) ([7a889c9](https://github.com/demeesterroel/CarSharing/commit/7a889c931da5a418d8ead5fdff21a0f67e675868))
* **pwa:** add icon metadata so browser tab shows favicon ([2cd23dd](https://github.com/demeesterroel/CarSharing/commit/2cd23dd0e539f959c79031032eac9bd920fad1cd))
* **pwa:** add missing TypeScript SWC helpers to service worker ([91c5e84](https://github.com/demeesterroel/CarSharing/commit/91c5e84cfb73fd5abd9a07c8ae22def0916c7e92))
* **pwa:** capitalise AutoDelen consistently in page title ([13183e5](https://github.com/demeesterroel/CarSharing/commit/13183e5e79050bd4899cc1cbefcefad6610e6d15))
* **pwa:** exclude manifest.json, sw.js, and workbox assets from auth middleware ([aa344f8](https://github.com/demeesterroel/CarSharing/commit/aa344f8b778ff733dcfad251b5d981d4bf79b0be))
* **pwa:** exclude source.svg from SW precache ([36e8087](https://github.com/demeesterroel/CarSharing/commit/36e808756cc2e580ba9e58ab73e460f2e3004f38))
* readId integer guard, FuelFillupInput price_per_liter, reservations no dashboard invalidation ([7ec40e1](https://github.com/demeesterroel/CarSharing/commit/7ec40e1d939f91190814f975b2c8676a9d88f6c5))
* remove accidentally committed data symlink, move db into data/ ([f0a4633](https://github.com/demeesterroel/CarSharing/commit/f0a46331badc1d4dc33e78f518938479bf93f6ff))
* **routing:** remove incorrect !newValue guard in useQueryParam ([b1bf59f](https://github.com/demeesterroel/CarSharing/commit/b1bf59fc20126057d644842517ccf993cbce0b31))
* **routing:** wrap all URL-param pages in Suspense for Next.js 15 useSearchParams ([3104ca7](https://github.com/demeesterroel/CarSharing/commit/3104ca7cafe3fd7f07cce5ea5d6578dae8bd50d5))
* **scripts:** correct production URL to autodelen.bluette.be ([795ef92](https://github.com/demeesterroel/CarSharing/commit/795ef9298e679c0a4f31cfc6aa9810953a7a3268))
* show loading state on calendar page while reservations load ([7c50cc9](https://github.com/demeesterroel/CarSharing/commit/7c50cc9383effb55d05bfbb6034c4dbaa4f896e8))
* **ui:** align card designs and date formats across all pages ([#17](https://github.com/demeesterroel/CarSharing/issues/17)) ([#44](https://github.com/demeesterroel/CarSharing/issues/44)) ([29b8ed6](https://github.com/demeesterroel/CarSharing/commit/29b8ed6a76911aa1185e9af7ed0ccee88022f92c))
* **ui:** reverse filter toggle order to All | Mine on trips, fuel, expenses ([#41](https://github.com/demeesterroel/CarSharing/issues/41)) ([e863546](https://github.com/demeesterroel/CarSharing/commit/e863546754f8d70d3ef51722a13947228bace4a2)), closes [#14](https://github.com/demeesterroel/CarSharing/issues/14)
* validate year param in dashboard route to prevent NaN queries ([f18e524](https://github.com/demeesterroel/CarSharing/commit/f18e5245a9d5319b6c37b5ae7924d778abe499f9))


### ⚡ Performance

* **docker:** switch to node:20-slim to skip better-sqlite3 native compilation ([41a9d95](https://github.com/demeesterroel/CarSharing/commit/41a9d959ba97f2747771a453317557fc5731bfd0))


### 📖 Documentation

* i18n retrofit plans 04-09, car prefill, fuel location, auth design ([50804ae](https://github.com/demeesterroel/CarSharing/commit/50804ae5dfc18d0d5c5defde936ffc25e672ac02))
* **openapi:** expand spec to cover all API routes ([4085b74](https://github.com/demeesterroel/CarSharing/commit/4085b74c388e02f924935a1546f40c15d7f5f424))
* **plan-04:** add persistent BottomTabBar for trips and fuel ([11fae15](https://github.com/demeesterroel/CarSharing/commit/11fae15951e76cc4194e0868d7dad643ccf2df56))
* **plan-11:** auth gate Phase A implementation plan ([f4c9a93](https://github.com/demeesterroel/CarSharing/commit/f4c9a931f9538d429d05f8355bd952ed6b0267d4))
* **plans:** clarify offline scope — members write, admin/owner read-only ([cbf0c39](https://github.com/demeesterroel/CarSharing/commit/cbf0c39ca0c7dffc1a58def5357e46da2f7e5344))
* **plans:** offline Phase 1 and Phase 2 implementation plans ([0490ad2](https://github.com/demeesterroel/CarSharing/commit/0490ad2f60f500b4feb338e87b3895a1e0871acd))
* point NAMING.md UI-labels section to i18n module ([6732133](https://github.com/demeesterroel/CarSharing/commit/6732133edf253327a804722c745c76f7350f97bf))
* PWA icon & installation design spec ([#9](https://github.com/demeesterroel/CarSharing/issues/9)) ([3cc2a66](https://github.com/demeesterroel/CarSharing/commit/3cc2a66fe69cb13695c4588822be9ae4b43f67dc))
* PWA icon installation implementation plan ([#9](https://github.com/demeesterroel/CarSharing/issues/9)) ([9195877](https://github.com/demeesterroel/CarSharing/commit/9195877934d1ad985fe6a56c0dd80c2e2675fc1c))
* review plans — extract shared helpers, fix Next 15 breakage, optimize dashboard ([0e8f48b](https://github.com/demeesterroel/CarSharing/commit/0e8f48b6e056a8e742e4d8c2afb674cc0e6af6d4))

## [1.3.1](https://github.com/demeesterroel/CarSharing/compare/carsharing-v1.3.0...carsharing-v1.3.1) (2026-05-01)


### 🐛 Bug fixes

* **build:** clean up Next.js 16 build warnings ([#84](https://github.com/demeesterroel/CarSharing/issues/84)) ([eae7238](https://github.com/demeesterroel/CarSharing/commit/eae72382954c018912fe6055795b5be00c3016da))
* **build:** use --webpack flag for Next.js 16 compatibility with next-pwa ([a4b1e05](https://github.com/demeesterroel/CarSharing/commit/a4b1e054bfeb80f6b4bba038007f4805a8139eb7))
* **docker:** add python3/make/g++ to builder for better-sqlite3 fallback ([4defb55](https://github.com/demeesterroel/CarSharing/commit/4defb556f54855c41cf952365fc241d0d1755cac))

## [1.3.0](https://github.com/demeesterroel/CarSharing/compare/carsharing-v1.2.1...carsharing-v1.3.0) (2026-05-01)


### ✨ New features

* **deps:** upgrade Next.js 15 → 16.2.4 with webpack mode for PWA ([#81](https://github.com/demeesterroel/CarSharing/issues/81)) ([4ffeaad](https://github.com/demeesterroel/CarSharing/commit/4ffeaad2462b334c740defaab3a02220ede62688))
* **e2e:** add CRUD and reservation approval E2E tests ([#60](https://github.com/demeesterroel/CarSharing/issues/60)) ([#79](https://github.com/demeesterroel/CarSharing/issues/79)) ([43a77be](https://github.com/demeesterroel/CarSharing/commit/43a77beb3cba9d52cdabbebfd421cc72925eac7b))
* **settlement:** annual owner payout settlement ([#7](https://github.com/demeesterroel/CarSharing/issues/7)) ([#82](https://github.com/demeesterroel/CarSharing/issues/82)) ([88534d6](https://github.com/demeesterroel/CarSharing/commit/88534d6c9afeff71cc3c186e41042c607196bc1b))

## [1.2.1](https://github.com/demeesterroel/CarSharing/compare/carsharing-v1.2.0...carsharing-v1.2.1) (2026-04-29)


### 🐛 Bug fixes

* **members:** use apiFetch for savePerson and handleCloak to include CSRF token ([#77](https://github.com/demeesterroel/CarSharing/issues/77)) ([e8d9c78](https://github.com/demeesterroel/CarSharing/commit/e8d9c785643328623a0ffbcfe2f5202b56977586))

## [1.2.0](https://github.com/demeesterroel/CarSharing/compare/carsharing-v1.1.2...carsharing-v1.2.0) (2026-04-29)


### ✨ New features

* **owner:** filter admin inbox and data hygiene to owner's cars only ([#69](https://github.com/demeesterroel/CarSharing/issues/69)) ([#71](https://github.com/demeesterroel/CarSharing/issues/71)) ([960b39a](https://github.com/demeesterroel/CarSharing/commit/960b39a184692204c452f1fac0ab556e711e450a))
* **ux:** add language switcher to login screen ([#74](https://github.com/demeesterroel/CarSharing/issues/74)) ([#75](https://github.com/demeesterroel/CarSharing/issues/75)) ([fb087d0](https://github.com/demeesterroel/CarSharing/commit/fb087d02cc17bced2f90c5c8c106d3b140e4a5e4))


### 🐛 Bug fixes

* **owner:** apply owner car filter to inbox pending count in subnav ([#69](https://github.com/demeesterroel/CarSharing/issues/69)) ([#73](https://github.com/demeesterroel/CarSharing/issues/73)) ([7a889c9](https://github.com/demeesterroel/CarSharing/commit/7a889c931da5a418d8ead5fdff21a0f67e675868))

## [1.1.2](https://github.com/demeesterroel/CarSharing/compare/carsharing-v1.1.1...carsharing-v1.1.2) (2026-04-29)


### 🐛 Bug fixes

* **lint:** exclude .worktrees from ESLint to prevent scanning generated .next build files ([6c31bc9](https://github.com/demeesterroel/CarSharing/commit/6c31bc9e08347372966212ec71598727c387a489))

## [1.1.1](https://github.com/demeesterroel/CarSharing/compare/carsharing-v1.1.0...carsharing-v1.1.1) (2026-04-29)


### 🐛 Bug fixes

* **auth:** owners can only access their allowed admin pages ([#63](https://github.com/demeesterroel/CarSharing/issues/63)) ([#68](https://github.com/demeesterroel/CarSharing/issues/68)) ([964774d](https://github.com/demeesterroel/CarSharing/commit/964774dec4390fba3ab6a930ae15401ed8f197d4))
* **build:** add SessionData type to requireAdmin for TypeScript compatibility ([e25c704](https://github.com/demeesterroel/CarSharing/commit/e25c7045595337db975c2e972658fba3f7d2f485))
* **build:** remove SESSION_PASSWORD placeholder from Dockerfile; add versioned Docker tags on release ([7341836](https://github.com/demeesterroel/CarSharing/commit/73418365e33df64f96f3e8dd9de82ea17d056d34))

## [1.1.0](https://github.com/demeesterroel/CarSharing/compare/carsharing-v1.0.0...carsharing-v1.1.0) (2026-04-29)


### ✨ New features

* add 10-part implementation plan ([d9b9e5c](https://github.com/demeesterroel/CarSharing/commit/d9b9e5ccfa3289ef5a7a02ae39289b7cb769a744))
* add PersonInput and CarInput type aliases ([1670e02](https://github.com/demeesterroel/CarSharing/commit/1670e025e06cd55bd2603d890618cc8c6c32a8db))
* admin cloak-as-member ([#6](https://github.com/demeesterroel/CarSharing/issues/6)) ([#46](https://github.com/demeesterroel/CarSharing/issues/46)) ([9bb5dba](https://github.com/demeesterroel/CarSharing/commit/9bb5dba275e4bd8472411784f05494462aacb786))
* **admin-restructure:** merge Wagens + Break-even into single tab ([3daa89d](https://github.com/demeesterroel/CarSharing/commit/3daa89dbdcf3ae03a86cbabef669406112f2e6a8))
* **admin-restructure:** merge Wagens + Break-even into single tab ([3daa89d](https://github.com/demeesterroel/CarSharing/commit/3daa89dbdcf3ae03a86cbabef669406112f2e6a8))
* **admin-restructure:** merge Wagens + Break-even into single tab ([dc45d8c](https://github.com/demeesterroel/CarSharing/commit/dc45d8c8ab95135ba1fde681d5fba3819c8e7627))
* **admin/cars:** accordion car rows, no pencil ([#16](https://github.com/demeesterroel/CarSharing/issues/16)) ([#47](https://github.com/demeesterroel/CarSharing/issues/47)) ([4f66f54](https://github.com/demeesterroel/CarSharing/commit/4f66f54dabbbe76fb5e1362334556a6bc54f33bd))
* **admin/members:** accordion rows + CarBadge + consistent buttons ([#48](https://github.com/demeesterroel/CarSharing/issues/48)) ([#49](https://github.com/demeesterroel/CarSharing/issues/49)) ([38b7aed](https://github.com/demeesterroel/CarSharing/commit/38b7aed92a7f1e3942fbd623118f3476446a8e5a))
* **api:** add /api/health unauthenticated heartbeat endpoint ([16f6e88](https://github.com/demeesterroel/CarSharing/commit/16f6e889fa5b7a6cc50a6cd533b51cad7103692a))
* app shell with providers and layout ([5394170](https://github.com/demeesterroel/CarSharing/commit/53941701643d03472c486f7ec55e1c7395fe51a0))
* **auth:** hash-password script for generating AUTH_PASSWORD_HASH ([03da578](https://github.com/demeesterroel/CarSharing/commit/03da5786f28e13e2c512a15393d37b365daa2c39))
* **auth:** install iron-session + bcryptjs, add i18n keys, document env vars ([14c3362](https://github.com/demeesterroel/CarSharing/commit/14c3362dc0942cf6d470657d2325edc520c006ca))
* **auth:** login API route with timing-safe credential check ([429bda0](https://github.com/demeesterroel/CarSharing/commit/429bda0fdc8ce4eb4c2aff80b8af8366fb5f5405))
* **auth:** login page with inline error and redirect on success ([2840419](https://github.com/demeesterroel/CarSharing/commit/2840419aa4d5e6fb140711584953201e57156a10))
* **auth:** logout API route ([2504fca](https://github.com/demeesterroel/CarSharing/commit/2504fcab2dbe0b6e927d4926d855a09a955a9d57))
* **auth:** logout button in nav drawer ([cb5609d](https://github.com/demeesterroel/CarSharing/commit/cb5609daa5e1d1e9ee3bcd2f12fe5ab6915280ff))
* **auth:** middleware redirects unauthenticated requests to /login ([fab4570](https://github.com/demeesterroel/CarSharing/commit/fab457063643b32fa0aa3c3f9b5dc939347ac8c8))
* **auth:** per-person credentials, roles, and invite flow ([f377d34](https://github.com/demeesterroel/CarSharing/commit/f377d34853d778643160f6fef89afa41761cb120))
* **auth:** per-person credentials, roles, and invite flow ([f377d34](https://github.com/demeesterroel/CarSharing/commit/f377d34853d778643160f6fef89afa41761cb120))
* **auth:** per-person credentials, roles, and invite flow ([63077fb](https://github.com/demeesterroel/CarSharing/commit/63077fba8f39a4ce5ca85f0abc30af85599c5727))
* **auth:** session options module and timing-safe credential helper with tests ([599bc27](https://github.com/demeesterroel/CarSharing/commit/599bc27b4410e50be6bd31cf0e81a2c3a94a09e7))
* calendar page with FullCalendar and inclusive end-date rendering ([0d34e45](https://github.com/demeesterroel/CarSharing/commit/0d34e45a078d24db62a0fda6c152d09e5dbb3903))
* **calendar:** self-contained PickCalendar with nav, stable layout, and role-aware submit ([dcbfaf4](https://github.com/demeesterroel/CarSharing/commit/dcbfaf40f608a97fe6db358deae1bf25d8f2af41))
* car last-state query, API route, and hook ([6e481ec](https://github.com/demeesterroel/CarSharing/commit/6e481ecd27c4a6265fc7284285ae061f1b652274))
* car toggle button group component ([3865079](https://github.com/demeesterroel/CarSharing/commit/3865079a1079aa828ba3186c6ce4dd9471511b79))
* cars API routes with zod validation ([fdf17ff](https://github.com/demeesterroel/CarSharing/commit/fdf17ffdf6faeeef592d643e94173195e0e5de92))
* cars list and add/edit form ([3bf11eb](https://github.com/demeesterroel/CarSharing/commit/3bf11eb4cebe0f7c310abf3b84170ac4acd357b4))
* createResourceHooks factory for CRUD hooks ([146286b](https://github.com/demeesterroel/CarSharing/commit/146286b0b9094ab2b8ea226bc2dd4e425974104b))
* dashboard API route ([65a3f8d](https://github.com/demeesterroel/CarSharing/commit/65a3f8dd394286422cf57ff4cdd3f90bccf6e82e))
* dashboard page with per-person balance and year navigation ([af4156c](https://github.com/demeesterroel/CarSharing/commit/af4156c7ddd56b5185c8edb63999e28045eca3cd))
* dashboard query aggregates in 4 GROUP BY passes with tests ([80e3bdc](https://github.com/demeesterroel/CarSharing/commit/80e3bdca9c0cab61baad0544846879d63ae46790))
* **dashboard:** add expense_count to DashboardRow ([c1188ba](https://github.com/demeesterroel/CarSharing/commit/c1188ba8dff80debbcf1c7e6f6c8550d6e66b884))
* **dashboard:** add hover highlight on clickable receipt rows ([4921812](https://github.com/demeesterroel/CarSharing/commit/4921812eece7c67372be0922531fc8c85a23dcea))
* **dashboard:** receipt-style activity summary with clickable lines ([eabfeb5](https://github.com/demeesterroel/CarSharing/commit/eabfeb5753a86d8f43b6463f7728329349da2aea))
* **dashboard:** year navigation with dynamic earliest-year bound ([e3a3eb4](https://github.com/demeesterroel/CarSharing/commit/e3a3eb458c71a97b9c4cc3f7e1e64a120baf61fe))
* **db:** replace ad-hoc schema with versioned SQL migrations ([5c99670](https://github.com/demeesterroel/CarSharing/commit/5c99670207261e8cfcd39687a10ce5492aeb7ed8))
* deep linking — URL-synced filters, tabs, and modals ([e90e03e](https://github.com/demeesterroel/CarSharing/commit/e90e03e6b7a480de1de0178d1ae18dbbd8032bdd))
* **docs:** add /docs page with Swagger UI rendered from local npm package ([17fa6a8](https://github.com/demeesterroel/CarSharing/commit/17fa6a8402eeaec801ec1ebf16c245d43299a613))
* domain types with english field names ([d917ccf](https://github.com/demeesterroel/CarSharing/commit/d917ccfabd0c527acc9ae186cf7fc35b331f78c8))
* english naming throughout, seed script from exported data, naming reference ([a6f7aa0](https://github.com/demeesterroel/CarSharing/commit/a6f7aa03cb7b8e0bbc30b19c2f98b4eb12f703d0))
* expense query helpers ([83e374b](https://github.com/demeesterroel/CarSharing/commit/83e374bf678f90426b49ccc5d9d90373bca71494))
* expenses API routes with zod validation ([4fb30b8](https://github.com/demeesterroel/CarSharing/commit/4fb30b8bfe1a5b56420c1532ddd8f3020689dc6c))
* expenses page with grouped list ([7163cc5](https://github.com/demeesterroel/CarSharing/commit/7163cc547230f7edaa57e36ce6e839e5accf9c70))
* **fixed-costs:** replace 4-field schema with line-item array ([cb6d08f](https://github.com/demeesterroel/CarSharing/commit/cb6d08fd5898956e03a79414d17f706027e7c3a3))
* **fixed-costs:** replace 4-field schema with line-item array ([cb6d08f](https://github.com/demeesterroel/CarSharing/commit/cb6d08fd5898956e03a79414d17f706027e7c3a3))
* **fixed-costs:** replace 4-field schema with line-item array ([2bc4ca2](https://github.com/demeesterroel/CarSharing/commit/2bc4ca24867145871310a444b3f788f829884ff7))
* fuel fill-up API routes with zod validation ([019a285](https://github.com/demeesterroel/CarSharing/commit/019a285125077a60ab0fe3950923aed446600f53))
* fuel fill-up query helpers ([abefa9a](https://github.com/demeesterroel/CarSharing/commit/abefa9a4222fded8b79790e10fe55a4551ec1c4d))
* fuel page with receipt upload and auto price-per-liter ([2880d84](https://github.com/demeesterroel/CarSharing/commit/2880d8485c79983deb41d7d1047db72b4382ddc5))
* grouped list component with month headers and totals ([15b63b5](https://github.com/demeesterroel/CarSharing/commit/15b63b5a3e908860fb5e584a23b9a6b68e2c4083))
* **hygiene:** click gap to assign person — creates gap-filling trip ([2e4c6d4](https://github.com/demeesterroel/CarSharing/commit/2e4c6d420448e4f970a320094f8329f835e18865))
* i18n, paper theme, fleet economics, auth, reservations, admin ([991c446](https://github.com/demeesterroel/CarSharing/commit/991c446b396ad8d105bd375ee3175a04796a5fda))
* **i18n:** dutch message dictionary ([c046829](https://github.com/demeesterroel/CarSharing/commit/c046829692d780c966b94fa1802317fa14165047))
* **i18n:** replace all hardcoded inline strings with t() calls; fix Scalar docs route ([61e842d](https://github.com/demeesterroel/CarSharing/commit/61e842debdf651751a0e33e7de435ff0399fdd7b))
* **i18n:** t() helper with typed keys and {param} substitution ([bbf9e58](https://github.com/demeesterroel/CarSharing/commit/bbf9e58ae080bfad442339e4d8c2547655540fcb))
* individual resource hooks using createResourceHooks factory ([a1c8111](https://github.com/demeesterroel/CarSharing/commit/a1c81118c726ad58a674219bcea3fe7408bd5761))
* json/readBody/readId api helpers with tests ([2c08700](https://github.com/demeesterroel/CarSharing/commit/2c087001773b919e60da82c8bc42dab978001d05))
* **mine-filter:** All/Mine filter on trips, fuel, expenses ([b7607f5](https://github.com/demeesterroel/CarSharing/commit/b7607f54c566360845d2a65db255e7f5d60c0523))
* **mine-filter:** All/Mine filter toggle on trips, fuel, expenses ([b7607f5](https://github.com/demeesterroel/CarSharing/commit/b7607f54c566360845d2a65db255e7f5d60c0523))
* **mine-filter:** All/Mine filter toggle on trips, fuel, expenses ([d167512](https://github.com/demeesterroel/CarSharing/commit/d167512da9507ee13ec3ada72ead055df3028b4d))
* multi-stage dockerfile with native module compile in builder ([de5247f](https://github.com/demeesterroel/CarSharing/commit/de5247f4aa1f7ff5e3ab20c8faa26bfe68d4962c))
* nav drawer and page header ([efb794f](https://github.com/demeesterroel/CarSharing/commit/efb794f58b9c02ce8eac6d0b9ef1ee962ff4e2aa))
* **offline:** boot-time prewarm of critical API endpoints ([e5a9982](https://github.com/demeesterroel/CarSharing/commit/e5a9982e63ac15b22b7b501b63fffeeb39226c94))
* **offline:** disable add/save actions when offline ([c9791c5](https://github.com/demeesterroel/CarSharing/commit/c9791c5a394889289eba287da84a218797e61806))
* **offline:** header badge with fresh/stale states ([4b19104](https://github.com/demeesterroel/CarSharing/commit/4b19104baa69a61b8290599bf2e19cd6938ce2e8))
* **offline:** online-state context with heartbeat and staleness ([03a5184](https://github.com/demeesterroel/CarSharing/commit/03a518402d9964d46b4a85226159dc9d20c560b0))
* **offline:** Phase 1 — read-only offline support with SW caching & status indicator ([7f26fed](https://github.com/demeesterroel/CarSharing/commit/7f26fed837cc2ca2d0f513d87bbfd30209a5316e))
* **offline:** refetch lastCarState on trip form open + offline hint ([18cbcc8](https://github.com/demeesterroel/CarSharing/commit/18cbcc8d9c7e63d6ee6eca86b79eee02a79df3dc))
* **offline:** refetch reservations on new-reservation sheet open ([b631ebb](https://github.com/demeesterroel/CarSharing/commit/b631ebb460bfd47725d4553b82367aa5193e51cb))
* **offline:** show OfflineBadge in every page header ([f7e48a9](https://github.com/demeesterroel/CarSharing/commit/f7e48a94bcd208e708170d219b67ea9805d8dacf))
* **offline:** trigger boot-time prewarm after auth resolved ([d39c0ec](https://github.com/demeesterroel/CarSharing/commit/d39c0ec08fe6a07715e183f54cd4742011297280))
* **offline:** wire OnlineStateProvider into app shell ([1e94957](https://github.com/demeesterroel/CarSharing/commit/1e94957d33f2a8588c878bcc1a2df37aefed2919))
* paper theme, receipt redesign, reservation UX overhaul ([c905883](https://github.com/demeesterroel/CarSharing/commit/c9058832f30c4d08cd154dc0fc1a661c3ac4f9a0))
* payment query helpers ([6972ba9](https://github.com/demeesterroel/CarSharing/commit/6972ba9f49b2a8b59ff5e6f9657057de6aeb9f45))
* payments API routes with zod validation ([6d65e5d](https://github.com/demeesterroel/CarSharing/commit/6d65e5d735654783211577aae2be0129073316db))
* payments page ([e130d1b](https://github.com/demeesterroel/CarSharing/commit/e130d1b78cf1ee4e3025d3c3fec2af0f41c218ce))
* people and cars query helpers with tests ([d149b25](https://github.com/demeesterroel/CarSharing/commit/d149b25f2bbf6efa5e587f47ce722bf14478a45d))
* people API routes with zod validation and error wrapper ([4f8c5c5](https://github.com/demeesterroel/CarSharing/commit/4f8c5c5a4aa761b86381fa66048615827273fae9))
* people list and add/edit form ([c35eac7](https://github.com/demeesterroel/CarSharing/commit/c35eac7836d91e24cbcc4f58db1bec4d6cdd1052))
* persistent bottom tab bar for trips and fuel ([8515899](https://github.com/demeesterroel/CarSharing/commit/851589981afc7fcf54a1ec1ff92e44a5e831d159))
* person select and floating action button ([9a68060](https://github.com/demeesterroel/CarSharing/commit/9a68060c96492b75fc63e7de46193488bbb1e256))
* Phase 4 — UX improvements (error boundaries, optimistic updates, offline queue) ([#56](https://github.com/demeesterroel/CarSharing/issues/56)) ([5b5839c](https://github.com/demeesterroel/CarSharing/commit/5b5839c75fb2be65fdcda6b7da4b2dd44d458f1c))
* Phase 6 — JSDoc, OpenAPI spec, accessibility fixes, and version in header ([#59](https://github.com/demeesterroel/CarSharing/issues/59)) ([c985ecb](https://github.com/demeesterroel/CarSharing/commit/c985ecba58a88cad97ec12970f951b9bf54cc157))
* PWA manifest and icons ([20e3f48](https://github.com/demeesterroel/CarSharing/commit/20e3f48cb766f9cf5b3c886b37e6839228cd02ea))
* PWA service worker via @ducanh2912/next-pwa ([32be72f](https://github.com/demeesterroel/CarSharing/commit/32be72f13fb638aa94f5778ce6de745d1d3b4c4a))
* **pwa:** apple-touch-icon 180px, appleWebApp title AutoDelen, align theme-color ([09bf21d](https://github.com/demeesterroel/CarSharing/commit/09bf21d5ab91ef8737f777b6292654f6b063b3f0))
* **pwa:** explicit runtime caching with StaleWhileRevalidate for data APIs ([1062e4d](https://github.com/demeesterroel/CarSharing/commit/1062e4d50b67a825549a8898724e0dc0bfd4ea78))
* **pwa:** generate people+car icons in all required sizes ([607ab9f](https://github.com/demeesterroel/CarSharing/commit/607ab9fdf62c717119557b9434485f7d36db767a))
* **pwa:** update manifest — AutoDelen name, paper/ink colours, maskable icon ([6cda958](https://github.com/demeesterroel/CarSharing/commit/6cda9583dc39c2b502627895e355656c96d9f209))
* receipt-upload component ([03dd5ae](https://github.com/demeesterroel/CarSharing/commit/03dd5ae7077c4bacee029d445d2be0bcf5c3f1c5))
* reservation query helpers ([086d669](https://github.com/demeesterroel/CarSharing/commit/086d6690ff542f9c31b5bf0051e7270ef80edc34))
* reservations API routes with zod validation ([ecff9e6](https://github.com/demeesterroel/CarSharing/commit/ecff9e6f7e893dd2691894210a48bd332a20f821))
* **reservations:** replace FullCalendar with 14-day per-car timeline ([4b2bda6](https://github.com/demeesterroel/CarSharing/commit/4b2bda624a199c8c3b4727827a0bd508f75635a3))
* **reservations:** replace FullCalendar with 14-day per-car timeline ([4b2bda6](https://github.com/demeesterroel/CarSharing/commit/4b2bda624a199c8c3b4727827a0bd508f75635a3))
* **reservations:** replace FullCalendar with 14-day per-car timeline ([5e098f9](https://github.com/demeesterroel/CarSharing/commit/5e098f940a8e17f258a0eb258889e803ff85de36))
* **routing:** add useQueryParam hook for URL-synced filter state ([270e243](https://github.com/demeesterroel/CarSharing/commit/270e243ac5c17fcb158463bd15a856cc7f4a6468))
* **routing:** sync admin sub-tab to ?tab= URL param ([c5b29d0](https://github.com/demeesterroel/CarSharing/commit/c5b29d0e25c20c4f48942d9ef34a2188ecf946d8))
* **routing:** sync calendar modals to URL params ([8309b44](https://github.com/demeesterroel/CarSharing/commit/8309b44ea51a99a60c2d3d20972d58d9b5e35502))
* **routing:** sync expenses filters and modals to URL params ([8d6fb00](https://github.com/demeesterroel/CarSharing/commit/8d6fb00146075c438fbb3c09a8f85a0a605c7446))
* **routing:** sync fuel filters and modals to URL params ([660b493](https://github.com/demeesterroel/CarSharing/commit/660b493fe0959de1305acf8b232f8465587f9926))
* **routing:** sync trips filters and modals to URL params ([1104095](https://github.com/demeesterroel/CarSharing/commit/11040950c6dc176d10846337999f5d3f1c9bef8d))
* **scripts:** generate-invite — create invite link for a person by name ([df1bf4e](https://github.com/demeesterroel/CarSharing/commit/df1bf4e755d6b2faaf647bbacaa5cb0000aac190))
* seed script from exported google sheets data ([469778f](https://github.com/demeesterroel/CarSharing/commit/469778f30d47693b3838210e7f53245819226fd6))
* sqlite connection singleton and english schema ([6ebcb3d](https://github.com/demeesterroel/CarSharing/commit/6ebcb3d35f88bf990ddf4084da8cf10d262ba685))
* TanStack Query hooks for people and cars ([021c474](https://github.com/demeesterroel/CarSharing/commit/021c47430eb2746203f3a84cf8ed0e5d7abb5639))
* trip amount and payment year formulas with tests ([fafdc76](https://github.com/demeesterroel/CarSharing/commit/fafdc7689d6f1dce2e1ab918d0df627746b05496))
* trips API routes with zod validation ([74e1bbd](https://github.com/demeesterroel/CarSharing/commit/74e1bbdc76757b7c17df82136ea63f9e54eb8404))
* trips hook and GPS location picker ([ed79a37](https://github.com/demeesterroel/CarSharing/commit/ed79a375056d5bfbd28d303e7cc01030dcbb9972))
* trips list page, form with GPS and auto-calculation ([f996b44](https://github.com/demeesterroel/CarSharing/commit/f996b445c46de35ea855607168aff1d18da90f24))
* trips query helpers with amount calculation ([e70e06f](https://github.com/demeesterroel/CarSharing/commit/e70e06f48e6d2c0c6057053952bac0438ed3c3aa))
* **ui:** replace native select with custom paper-styled year dropdown ([714d35a](https://github.com/demeesterroel/CarSharing/commit/714d35ad0e277bfa9e1a55e84646762205bbcd8f))
* **ui:** replace year toggle buttons with right-aligned dropdown ([642ca9f](https://github.com/demeesterroel/CarSharing/commit/642ca9f75e98a41e6ffb90bdc70af4920af4423f))
* upload route with size/mime validation and static serving ([046a0b2](https://github.com/demeesterroel/CarSharing/commit/046a0b26b54784560901c5747794f2ec42e30399))
* useFuelFillups hooks ([e875cd6](https://github.com/demeesterroel/CarSharing/commit/e875cd692771ced342e3d43a5eda183c8c844bbf))
* **ux:** apply paper design to login screen ([#50](https://github.com/demeesterroel/CarSharing/issues/50)) ([#62](https://github.com/demeesterroel/CarSharing/issues/62)) ([5472ddb](https://github.com/demeesterroel/CarSharing/commit/5472ddb4d77c23eb07ec9d0bf00c558b200be8f6))


### 🐛 Bug fixes

* **a11y:** allow pinch-zoom by raising maximum-scale from 1 to 5 ([4a7a1a1](https://github.com/demeesterroel/CarSharing/commit/4a7a1a1514e3340f0f46d70a7f8427a32501ed6c))
* add onError toasts, payment amount positive validation ([eb590b8](https://github.com/demeesterroel/CarSharing/commit/eb590b896c8d0061038187f9ec40dc72f1b0ae16))
* **admin/cars:** replace free-text owner field with people dropdown ([a3802cb](https://github.com/demeesterroel/CarSharing/commit/a3802cb961ee51daa69613bb2263309983887ed9))
* **admin:** include CSRF token when generating invite link ([#61](https://github.com/demeesterroel/CarSharing/issues/61)) ([#65](https://github.com/demeesterroel/CarSharing/issues/65)) ([55920ab](https://github.com/demeesterroel/CarSharing/commit/55920abfd331e6b4bf0ebad827ebdd944fcdd5a0))
* **auth:** only destroy session if authenticated in logout route ([31ce832](https://github.com/demeesterroel/CarSharing/commit/31ce832a177de356ee05081d5dec1d99ae6eaef4))
* **auth:** remove uploads from middleware bypass — receipt images require authentication ([0a19145](https://github.com/demeesterroel/CarSharing/commit/0a19145944f8af46feaf7d233d1df709c6823481))
* **calendar:** allow selecting boundary days of existing reservations ([8b8f5de](https://github.com/demeesterroel/CarSharing/commit/8b8f5de4051cd16655fe7c95d9a951ce37cf7d2b))
* complete useEffect dependency arrays in trip and fuel forms ([d016c50](https://github.com/demeesterroel/CarSharing/commit/d016c501750bd039fd3b0c55d2f651d13a120f67))
* create uploads dir on first upload, harden path traversal guard ([706ec8c](https://github.com/demeesterroel/CarSharing/commit/706ec8ceb2bba598b64b2f836ddffbfa01eaf20a))
* **dashboard:** defer toLocaleDateString to client to prevent SSR hydration mismatch ([91eaa9d](https://github.com/demeesterroel/CarSharing/commit/91eaa9d300eb27c320281f2443b609bb03734f11))
* **dashboard:** guard paid_amount sign in receipt display ([ce0d588](https://github.com/demeesterroel/CarSharing/commit/ce0d588eb3c898201f2a2d599f39d194d9733269))
* **db:** disable FK checks during migrations and update test/seed imports ([cbcaa8b](https://github.com/demeesterroel/CarSharing/commit/cbcaa8b1367d5ce601d0f7c9e508130a7577c87f))
* **docker:** provide SESSION_PASSWORD placeholder for next build ([b2fced6](https://github.com/demeesterroel/CarSharing/commit/b2fced61d92043d7f1efc22bb3502d69a08ee1ba))
* **env:** lazy-validate env at first access, not at import time ([a06d6c4](https://github.com/demeesterroel/CarSharing/commit/a06d6c4a456b6fb7cc56ec8f8e8bf002ec42327b))
* **env:** remove process.cwd() — not available in edge runtime ([58a06b2](https://github.com/demeesterroel/CarSharing/commit/58a06b2889f8229c8a0315ecdf5e9b0e5ae4b680))
* exclude pwa service worker artifacts from docker build context ([032e977](https://github.com/demeesterroel/CarSharing/commit/032e977b704060c5925eef962f406c1c11164894))
* **middleware:** add /api/docs to PUBLIC_PATHS so spec is accessible without login ([4dbebcd](https://github.com/demeesterroel/CarSharing/commit/4dbebcd01166255b8ba0151131c74faebef8e3cd))
* nav drawer accessibility and grouped list react keys ([8b504e7](https://github.com/demeesterroel/CarSharing/commit/8b504e785c23f419bcb2fe248f994b5729c565a8))
* **nav:** remove redundant exit-cloak button from bottom tab bar ([#64](https://github.com/demeesterroel/CarSharing/issues/64)) ([6959a24](https://github.com/demeesterroel/CarSharing/commit/6959a24badf39f020ac1d843cf6f5ba84f81d6c8))
* NextResponse for 201, active checkbox, empty string to null for car fields ([bccb07f](https://github.com/demeesterroel/CarSharing/commit/bccb07fa7045ba9e1c5e43a82c91257d497af8ad))
* **offline:** badge recovery + RSC cache ignores search params ([89bb3d7](https://github.com/demeesterroel/CarSharing/commit/89bb3d78b81ade4cf3da7835226a345c49366b2c))
* **offline:** block /admin navigation when offline ([4bce14c](https://github.com/demeesterroel/CarSharing/commit/4bce14cdbb73f7f015df2d902e5b7bf24cfda249))
* **offline:** correct fuel query key + merge RSC caches ([6de0024](https://github.com/demeesterroel/CarSharing/commit/6de00249496abeb70d8736b26930eed722f16c17))
* **offline:** intercept form submit at &lt;form&gt; level instead of button type ([17e5104](https://github.com/demeesterroel/CarSharing/commit/17e51048965d889dfc93f8456c56f3fe26b9c0a1))
* **pwa:** add icon metadata so browser tab shows favicon ([2cd23dd](https://github.com/demeesterroel/CarSharing/commit/2cd23dd0e539f959c79031032eac9bd920fad1cd))
* **pwa:** add missing TypeScript SWC helpers to service worker ([91c5e84](https://github.com/demeesterroel/CarSharing/commit/91c5e84cfb73fd5abd9a07c8ae22def0916c7e92))
* **pwa:** capitalise AutoDelen consistently in page title ([13183e5](https://github.com/demeesterroel/CarSharing/commit/13183e5e79050bd4899cc1cbefcefad6610e6d15))
* **pwa:** exclude manifest.json, sw.js, and workbox assets from auth middleware ([aa344f8](https://github.com/demeesterroel/CarSharing/commit/aa344f8b778ff733dcfad251b5d981d4bf79b0be))
* **pwa:** exclude source.svg from SW precache ([36e8087](https://github.com/demeesterroel/CarSharing/commit/36e808756cc2e580ba9e58ab73e460f2e3004f38))
* readId integer guard, FuelFillupInput price_per_liter, reservations no dashboard invalidation ([7ec40e1](https://github.com/demeesterroel/CarSharing/commit/7ec40e1d939f91190814f975b2c8676a9d88f6c5))
* remove accidentally committed data symlink, move db into data/ ([f0a4633](https://github.com/demeesterroel/CarSharing/commit/f0a46331badc1d4dc33e78f518938479bf93f6ff))
* **routing:** remove incorrect !newValue guard in useQueryParam ([b1bf59f](https://github.com/demeesterroel/CarSharing/commit/b1bf59fc20126057d644842517ccf993cbce0b31))
* **routing:** wrap all URL-param pages in Suspense for Next.js 15 useSearchParams ([3104ca7](https://github.com/demeesterroel/CarSharing/commit/3104ca7cafe3fd7f07cce5ea5d6578dae8bd50d5))
* **scripts:** correct production URL to autodelen.bluette.be ([795ef92](https://github.com/demeesterroel/CarSharing/commit/795ef9298e679c0a4f31cfc6aa9810953a7a3268))
* show loading state on calendar page while reservations load ([7c50cc9](https://github.com/demeesterroel/CarSharing/commit/7c50cc9383effb55d05bfbb6034c4dbaa4f896e8))
* **ui:** align card designs and date formats across all pages ([#17](https://github.com/demeesterroel/CarSharing/issues/17)) ([#44](https://github.com/demeesterroel/CarSharing/issues/44)) ([29b8ed6](https://github.com/demeesterroel/CarSharing/commit/29b8ed6a76911aa1185e9af7ed0ccee88022f92c))
* **ui:** reverse filter toggle order to All | Mine on trips, fuel, expenses ([#41](https://github.com/demeesterroel/CarSharing/issues/41)) ([e863546](https://github.com/demeesterroel/CarSharing/commit/e863546754f8d70d3ef51722a13947228bace4a2)), closes [#14](https://github.com/demeesterroel/CarSharing/issues/14)
* validate year param in dashboard route to prevent NaN queries ([f18e524](https://github.com/demeesterroel/CarSharing/commit/f18e5245a9d5319b6c37b5ae7924d778abe499f9))


### ⚡ Performance

* **docker:** switch to node:20-slim to skip better-sqlite3 native compilation ([41a9d95](https://github.com/demeesterroel/CarSharing/commit/41a9d959ba97f2747771a453317557fc5731bfd0))


### 📖 Documentation

* i18n retrofit plans 04-09, car prefill, fuel location, auth design ([50804ae](https://github.com/demeesterroel/CarSharing/commit/50804ae5dfc18d0d5c5defde936ffc25e672ac02))
* **openapi:** expand spec to cover all API routes ([4085b74](https://github.com/demeesterroel/CarSharing/commit/4085b74c388e02f924935a1546f40c15d7f5f424))
* **plan-04:** add persistent BottomTabBar for trips and fuel ([11fae15](https://github.com/demeesterroel/CarSharing/commit/11fae15951e76cc4194e0868d7dad643ccf2df56))
* **plan-11:** auth gate Phase A implementation plan ([f4c9a93](https://github.com/demeesterroel/CarSharing/commit/f4c9a931f9538d429d05f8355bd952ed6b0267d4))
* **plans:** clarify offline scope — members write, admin/owner read-only ([cbf0c39](https://github.com/demeesterroel/CarSharing/commit/cbf0c39ca0c7dffc1a58def5357e46da2f7e5344))
* **plans:** offline Phase 1 and Phase 2 implementation plans ([0490ad2](https://github.com/demeesterroel/CarSharing/commit/0490ad2f60f500b4feb338e87b3895a1e0871acd))
* point NAMING.md UI-labels section to i18n module ([6732133](https://github.com/demeesterroel/CarSharing/commit/6732133edf253327a804722c745c76f7350f97bf))
* PWA icon & installation design spec ([#9](https://github.com/demeesterroel/CarSharing/issues/9)) ([3cc2a66](https://github.com/demeesterroel/CarSharing/commit/3cc2a66fe69cb13695c4588822be9ae4b43f67dc))
* PWA icon installation implementation plan ([#9](https://github.com/demeesterroel/CarSharing/issues/9)) ([9195877](https://github.com/demeesterroel/CarSharing/commit/9195877934d1ad985fe6a56c0dd80c2e2675fc1c))
* review plans — extract shared helpers, fix Next 15 breakage, optimize dashboard ([0e8f48b](https://github.com/demeesterroel/CarSharing/commit/0e8f48b6e056a8e742e4d8c2afb674cc0e6af6d4))
