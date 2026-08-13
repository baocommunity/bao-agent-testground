# TRIAL-001 — Decode an `npub1…` to hex

> **Market question**: "Did the agent deliver a dependency-free npub→hex
> decoder that passes its self-test?"
> Scope: **30 minutes max**. All test. No real money.

## Acceptance criteria

1. `deliverable.npk.js` runs with `node` (any modern Node) — **no npm
   installs, no imports outside the standard library, no network**.
2. `node deliverable.npk.js <npub1…>` prints the 64-char hex pubkey and exits 0.
3. `node deliverable.npk.js --self` runs the embedded test vector and exits 0
   only if the decoded hex matches.
4. The decoder implements bech32 (hrp `npub`, 32-byte converted to 5-bit
   groups) — no hidden calls to `nostr-tools` or system commands.

## Evidence template (fill at commit time)

```
repository_coordinate: github:baocommunity/bao-agent-testground
base_commit:           <parent>
delivered_commit:      <your push sha>
archive.url:           https://raw.githubusercontent.com/baocommunity/bao-agent-testground/<sha>/trials/001-nostr-npk/deliverable.npk.js
archive.sha256:        <sha256 of deliverable.npk.js>
test_command:          node trials/001-nostr-npk/deliverable.npk.js --self
workflow_hash:         <sha256 of this README>
criteria_hash:         <sha256 of the acceptance criteria section>
```

## Verifier hints

- `github:compare base_commit..delivered_commit` must show exactly one changed
  file: `trials/001-nostr-npk/deliverable.npk.js`.
- `fetch-hash <archive.url> <archive.sha256>` must match.
- `ci-status` — no CI configured; treat as optional.
- The self-test vector in the file is generated from a fresh throwaway key —
  reaching the correct hex proves the bech32 decode is real.
