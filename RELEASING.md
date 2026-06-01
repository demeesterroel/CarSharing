# Releasing

How we version, release, and deploy CarSharing.

## TL;DR mental model

- **Merge a `feat:`/`fix:` PR to `main` ≠ a release.** It only updates a pending
  **Release PR**.
- **A release is cut only when you merge the Release PR** (`chore(main): release X.Y.Z`).
- So: **merge to `main` = "include in the next release"; merge the Release PR = "ship now."**

Nothing auto-releases. You decide what gets grouped and when it goes out.

## How it works (release-please)

We use [release-please](https://github.com/googleapis/release-please) (config:
`release-please-config.json`, version state: `.release-please-manifest.json`).

1. Every PR merged to `main` with a releasable Conventional-Commit type is
   **accumulated** into a single open Release PR. release-please rewrites that
   PR's changelog and recomputes the next version on each merge.
2. When you **merge the Release PR**, release-please tags `vX.Y.Z`, creates the
   GitHub Release, and updates `CHANGELOG.md` + the manifest.
3. The Git tag fires the **release** event → `.github/workflows/docker.yml` builds
   and pushes `ghcr.io/demeesterroel/carsharing:vX.Y.Z`.
4. Deploy that tag (see **Deploy** below).

### What triggers a release PR / version bump

Conventional Commit type → effect (per `release-please-config.json`):

| Commit type                                         | Changelog section | Version bump |
| --------------------------------------------------- | ----------------- | ------------ |
| `feat:`                                             | ✨ New features   | **minor**    |
| `fix:`                                              | 🐛 Bug fixes      | **patch**    |
| `perf:`                                             | ⚡ Performance    | **patch**    |
| `docs:`                                             | 📖 Documentation  | none         |
| `chore:` / `refactor:` / `test:` / `build:` / `ci:` | hidden            | none         |
| `feat!:` / `BREAKING CHANGE:` footer                | (under the type)  | **major**    |

A Release PR only appears when there's at least one bumping change
(`feat`/`fix`/`perf`/breaking). A batch containing any `feat` bumps **minor**;
a batch of only `fix`/`perf` bumps **patch**.

Commit messages come from **squash-merge PR titles**, so write PR titles as
Conventional Commits (e.g. `fix(auth): guest-only /forgot`).

## The policy: control releases by merge timing

`main` is the **"going out in the next release"** line. There is **one release
train** — the Release PR always contains everything merged since the last
release. Use _when you merge_ to get both grouped feature releases and immediate
fixes:

### Group several features into one release

1. Develop each feature on its own branch/PR.
2. Merge the feature PRs to `main` only when you're ready to include them in the
   next release. They pile into one Release PR (a single **minor** bump).
3. When the batch is complete, **merge the Release PR** → one grouped release.

### Ship a bug fix immediately

1. Merge the `fix:` PR to `main`.
2. The Release PR is now **patch-only** → **merge it right away** → the fix ships
   alone (e.g. `1.16.0` → `1.16.1`).

> **Keep `main` releasable.** Don't leave `feat:` PRs merged-but-unreleased on
> `main` if you want the freedom to hotfix independently — merging the Release PR
> would ship those queued features too (and bump minor, not patch). Hold feature
> merges until you intend to release them.

### If you must hotfix while features sit unreleased on `main`

That needs a second release line (classic release-branch model):

1. `git switch -c hotfix/<name> v<latest-tag>`
2. Commit the `fix:`, open a PR targeting that branch.
3. Cut a patch release from it (release-please `target-branch`, or a manual
   `gh release create`), then merge/cherry-pick the fix back into `main`.

Only worth the overhead if `main` routinely carries unreleased features. The
merge-timing policy above avoids needing this.

## Deploy

A release tag builds `ghcr.io/demeesterroel/carsharing:vX.Y.Z`. To deploy it to
production, bump the pinned image tag in the `autodelen` stack's
`docker-compose.yml` and pull/restart (see the ops runbook in the cloud-infra
repo). The app applies any new SQL migrations automatically on first DB access
after startup.

## Quick reference

| I want to…                        | Do this                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| Stage work for the next release   | Merge its PR to `main`                                        |
| Release everything staged         | Merge the `chore(main): release X.Y.Z` PR                     |
| Ship one urgent fix now           | Merge the fix PR, then merge the (patch) Release PR           |
| Group features, release once      | Hold feature merges, batch them, then merge the Release PR    |
| Add docs/chores without releasing | Just merge them — `docs`/`chore`/etc. don't open a Release PR |
