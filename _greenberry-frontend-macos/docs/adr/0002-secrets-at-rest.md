# ADR 0002 — Connection secrets at rest: plaintext in a 0600 SQLite app-db (no OS keychain)

- **Status:** Accepted
- **Date:** 2026-07-15
- **Story:** S10.4 (ROADMAP-GUI.md, Epic E10)
- **Code:** [`src-tauri/src/appdb.rs`](../../src-tauri/src/appdb.rs) · tests: [`src-tauri/tests/appdb.rs`](../../src-tauri/tests/appdb.rs)

## Context

E10 replaces the S2.2 persistence design (sanitized config in localStorage +
password in the macOS Keychain via the `keyring` crate) with a single local
SQLite application database at
`~/Library/Application Support/com.greenberry.desktop/greenberry.db`.
Connections — including their passwords — now live in one `connections` table
(S10.3: "no metadata/secret split"). That forces a decision about how those
passwords rest on disk.

Options considered:

- **A. Local plaintext, file restricted to the user (0600), risk documented.**
- **B. App-managed encryption key** — encrypt the password column with a key
  stored beside the database. The key sits next to the lock, so this is
  obfuscation, not security (the widely criticized DBeaver default).
- **C. SQLCipher** — full-database encryption. Real at-rest protection, but
  `sqlx` has no SQLCipher support (it would mean a second SQLite stack via
  `rusqlite/bundled-sqlcipher`), and the passphrase would itself need a home —
  either the OS keychain (which E10 removes by requirement) or a user prompt
  on every launch.

## Decision

**Option A.** Passwords are stored as plaintext columns in `greenberry.db`,
and the file is `chmod 0600` at creation (enforced in `AppDb::open`, asserted
by the `app_db_file_is_user_only` test).

Rationale:

- GreenBerry is a **local, single-user developer tool**; the threat actor who
  can read a 0600 file under `~/Library/Application Support` already runs code
  as that user and could equally read the app's memory, patch the binary, or
  phish the keychain prompt.
- Option B adds complexity while changing nothing about that threat model —
  a decrypt key on the same disk is documentation-by-ciphertext.
- Option C is the only real upgrade, but it either reintroduces the keychain
  (contradicting S10.2) or costs a passphrase prompt per launch — the wrong
  trade for a tool whose credentials are typically dev/staging databases.
- Honesty over theater: an explicit, documented plaintext posture is easier
  to audit and reason about than nominal encryption with a co-located key.

## Consequences

- Anyone with access to the user's macOS account (or an unencrypted backup of
  it) can read stored connection passwords. FileVault full-disk encryption is
  the assumed baseline for laptop loss/theft.
- The UI must never present stored passwords as protected: exporting or
  syncing `greenberry.db` exports the secrets.
- **Revisit triggers:** team/sync features, production-credential workflows,
  or `sqlx` gaining SQLCipher support — any of these reopens Option C.
