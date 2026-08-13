#!/usr/bin/env node
/**
 * TRIAL-001 deliverable — dependency-free npub1… → hex decoder.
 *
 * Implements bech32 (HRP "npub", 5-bit groups, BIP-0173 checksum) with zero
 * imports. Self-testable: `node deliverable.npk.js --self`.
 *
 * All test. AGPL-3.0. See trials/001-nostr-npk/README.md.
 */
'use strict';

// ── bech32 charset (BIP-0173) ───────────────────────────────────────────────
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const CHARSET_REV = Object.fromEntries([...CHARSET].map((c, i) => [c, i]));

function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function hrpExpand(hrp) {
  const out = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >>> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

function verifyChecksum(hrp, data) {
  return polymod([...hrpExpand(hrp), ...data]) === 1;
}

/** Convert 5-bit groups to 8-bit bytes (bech32 convertbits). */
function convertBits(data, from, to, pad) {
  let acc = 0;
  let bits = 0;
  const out = [];
  const maxv = (1 << to) - 1;
  for (const v of data) {
    if (v >>> from) throw new Error('invalid data');
    acc = (acc << from) | v;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >>> bits) & maxv);
    }
  }
  if (pad && bits) out.push((acc << (to - bits)) & maxv);
  else if (bits >= from || ((acc << (to - bits)) & maxv)) throw new Error('invalid padding');
  return out;
}

/**
 * Decode an npub1… string to its 64-char hex pubkey.
 * Throws with a clear message on malformed input.
 */
function npubToHex(input) {
  let npub = input;
  npub = String(npub).toLowerCase();
  if (typeof npub !== 'string' || !/^[a-z0-9]+$/.test(npub)) {
    throw new Error('npub must be a lowercase bech32 string');
  }
  const sep = npub.indexOf('1');
  if (sep < 1 || sep + 7 > npub.length) throw new Error('missing separator / short payload');
  const hrp = npub.slice(0, sep);
  if (hrp !== 'npub') throw new Error(`expected HRP "npub", got "${hrp}"`);
  const data = [];
  for (const c of npub.slice(sep + 1)) {
    if (!(c in CHARSET_REV)) throw new Error(`invalid bech32 char "${c}"`);
    data.push(CHARSET_REV[c]);
  }
  if (!verifyChecksum(hrp, data)) throw new Error('bad bech32 checksum');
  const bytes = convertBits(data.slice(0, -6), 5, 8, false);
  if (bytes.length !== 32) throw new Error(`expected 32 bytes, got ${bytes.length}`);
  return Buffer.from(bytes).toString('hex');
}

// ── self-test vector (fresh throwaway key, generated 2026-08-13) ────────────
const SELF_VECTORS = [
  ['npub1lm9zfxjydk4c4sa5f3mt7f6h5qeptzkv3du6keasznvxha7jfltqqq4hn5', 'feca249a446dab8ac3b44c76bf2757a032158acc8b79ab67b014d86bf7d24fd6'],
  ['npub1yzahpmawe2ux779qadqaynrpgjxm29v5n96rf9lj5lj5chvz77kqqd59qy', '20bb70efaecab86f78a0eb41d24c61448db5159499743497f2a7e54c5d82f7ac'],
  // Uppercase bech32 is valid per BIP-173 — must decode identically.
  ['NPUB1LM9ZFXJYDK4C4SA5F3MT7F6H5QEPTZKV3DU6KEASZNVXHA7JFLTQQQ4HN5', 'feca249a446dab8ac3b44c76bf2757a032158acc8b79ab67b014d86bf7d24fd6'],
];
// Invalid inputs must throw (never silently return garbage).
const INVALID_INPUTS = [
  'npub1lm9zfxjydk4c4sa5f3mt7f6h5qeptzkv3du6keasznvxha7jfltqqq4hn4', // bad checksum
  'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq', // wrong HRP
  'npub1qq', // payload too short
  'npub1LM9ZFXJYDK4C4SA5F3MT7F6H5QEPTZKV3DU6KEASZNVXHA7JFLTQQQ4HN5!', // invalid char
];

function main() {
  const arg = process.argv[2];
  if (arg === '--self') {
    try {
      const failures = [];
      for (const [npub, want] of SELF_VECTORS) {
        const got = npubToHex(npub);
        if (got !== want) failures.push(`vector mismatch: got ${got} want ${want}`);
      }
      for (const bad of INVALID_INPUTS) {
        let threw = false;
        try { npubToHex(bad); } catch { threw = true; }
        if (!threw) failures.push(`invalid input accepted: ${bad.slice(0, 24)}…`);
      }
      if (failures.length) {
        console.error('SELF-TEST FAIL:'); 
        for (const f of failures) console.error('  -', f);
        process.exit(1);
      }
      console.log('SELF-TEST PASS (3 vectors + 4 invalid inputs)');
      process.exit(0);
    } catch (e) {
      console.error('SELF-TEST FAIL:', e.message);
      process.exit(1);
    }
  }
  if (!arg) {
    console.error('usage: node deliverable.npk.js <npub1…>   |   node deliverable.npk.js --self');
    process.exit(2);
  }
  try {
    console.log(npubToHex(arg));
  } catch (e) {
    console.error(`decode error: ${e.message}`);
    process.exit(1);
  }
}

main();
