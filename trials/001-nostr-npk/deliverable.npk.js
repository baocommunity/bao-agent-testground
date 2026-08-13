#!/usr/bin/env node
/**
 * TRIAL-001 deliverable — dependency-free npub1… → hex decoder.
 *
 * Implements bech32 (HRP "npub", 5-bit groups, BIP-0173 checksum) with zero
 * imports. Self-testable: `node deliverable.npk.js --self`.
 *
 * NIP-19 defines npub as bech32 with human-readable part "npub" and a 32-byte
 * public key payload. This decoder validates the checksum, converts the 5-bit
 * data words back to 8-bit bytes, and returns the 64-character hex pubkey.
 *
 * All test. AGPL-3.0. See trials/001-nostr-npk/README.md.
 */
'use strict';

// ── bech32 charset (BIP-0173) ───────────────────────────────────────────────
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const CHARSET_REV = Object.fromEntries([...CHARSET].map((c, i) => [c, i]));

// BIP-0173 generator coefficients for the polynomial checksum.
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

// ── bech32 primitives ────────────────────────────────────────────────────────
function polymod(values) {
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

function verifyChecksum(hrp, dataWords) {
  return polymod([...hrpExpand(hrp), ...dataWords]) === 1;
}

/**
 * General convertBits from `fromBits` to `toBits`.
 * Throws on invalid words, illegal padding, or non-zero tail bits.
 */
function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const out = [];
  const maxv = (1 << toBits) - 1;
  const maxAcc = (1 << (fromBits + toBits - 1)) - 1;
  for (const v of data) {
    if (v >>> fromBits) throw new Error(`convertBits: value ${v} exceeds ${fromBits} bits`);
    acc = ((acc << fromBits) | v) & maxAcc;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      out.push((acc >>> bits) & maxv);
    }
  }
  if (pad) {
    if (bits) out.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    throw new Error('convertBits: illegal padding or non-zero tail bits');
  }
  return out;
}

// ── npub decoding ────────────────────────────────────────────────────────────
/**
 * Decode an npub1… string.
 *
 * Returns { hex, hrp, dataWords, bytes }.
 * Throws with a clear message on malformed input.
 */
function decodeNpub(input) {
  if (input === undefined || input === null) {
    throw new Error('input is required');
  }
  if (typeof input !== 'string') {
    throw new Error(`expected string, got ${typeof input}`);
  }
  const trimmed = input.trim();
  if (trimmed.length !== input.length) {
    throw new Error('input contains leading/trailing whitespace');
  }
  if (trimmed.length === 0) {
    throw new Error('input is empty');
  }

  // BIP-0173 allows mixed case, but requires the HRP to be lowercase after
  // case folding for comparison. We fold the whole string for decoding.
  const npub = trimmed.toLowerCase();
  if (!/^[a-z0-9]+$/.test(npub)) {
    throw new Error('input contains characters outside [A-Za-z0-9] or whitespace');
  }

  const sep = npub.indexOf('1');
  if (sep === -1) throw new Error('missing "1" separator between HRP and data');
  if (sep < 1) throw new Error('HRP is empty');
  if (sep + 7 > npub.length) throw new Error('data too short to contain checksum');

  const hrp = npub.slice(0, sep);
  if (hrp !== 'npub') throw new Error(`expected HRP "npub", got "${hrp}"`);

  const dataWords = [];
  const dataPart = npub.slice(sep + 1);
  for (const c of dataPart) {
    if (!(c in CHARSET_REV)) throw new Error(`invalid bech32 character "${c}"`);
    dataWords.push(CHARSET_REV[c]);
  }

  // The checksum is the final 6 data words.
  if (!verifyChecksum(hrp, dataWords)) {
    throw new Error('bech32 checksum verification failed');
  }

  const payloadWords = dataWords.slice(0, -6);
  const bytes = convertBits(payloadWords, 5, 8, false);
  if (bytes.length !== 32) {
    throw new Error(`expected 32 payload bytes, got ${bytes.length}`);
  }

  return {
    hrp,
    dataWords: payloadWords,
    bytes,
    hex: Buffer.from(bytes).toString('hex'),
  };
}

/** Convenience: decode and return only the hex pubkey. */
function npubToHex(input) {
  return decodeNpub(input).hex;
}

// ── self-test vectors ────────────────────────────────────────────────────────
// Each vector was generated from a fresh throwaway key.
const SELF_VECTORS = [
  ['npub1lm9zfxjydk4c4sa5f3mt7f6h5qeptzkv3du6keasznvxha7jfltqqq4hn5', 'feca249a446dab8ac3b44c76bf2757a032158acc8b79ab67b014d86bf7d24fd6'],
  ['npub1yzahpmawe2ux779qadqaynrpgjxm29v5n96rf9lj5lj5chvz77kqqd59qy', '20bb70efaecab86f78a0eb41d24c61448db5159499743497f2a7e54c5d82f7ac'],
  ['npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d', '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'],
  ['npub1hqw43v5lprytw84pvkhmk63wtmvsgaquucsf3sm4ms7pqr25e5gqu23hj5', 'b81d58b29f08c8b71ea165afbb6a2e5ed904741ce62098c375dc3c100d54cd10'],
  // Uppercase / mixed-case are valid per BIP-0173 and must decode identically.
  ['NPUB1LM9ZFXJYDK4C4SA5F3MT7F6H5QEPTZKV3DU6KEASZNVXHA7JFLTQQQ4HN5', 'feca249a446dab8ac3b44c76bf2757a032158acc8b79ab67b014d86bf7d24fd6'],
  ['Npub1yzahpmawe2ux779qadqaynrpgjxm29v5n96rf9lj5lj5chvz77kqqd59qy', '20bb70efaecab86f78a0eb41d24c61448db5159499743497f2a7e54c5d82f7ac'],
];

// Invalid inputs must throw (never silently return garbage).
const INVALID_INPUTS = [
  'npub1lm9zfxjydk4c4sa5f3mt7f6h5qeptzkv3du6keasznvxha7jfltqqq4hn4', // bad checksum (last char)
  'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq', // wrong HRP
  'Npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq', // wrong HRP case after fold
  'npub1qq', // payload too short
  'npub1LM9ZFXJYDK4C4SA5F3MT7F6H5QEPTZKV3DU6KEASZNVXHA7JFLTQQQ4HN5!', // invalid char
  '', // empty
  'npub1lm9zfxjydk4c4sa5f3mt7f6h5qeptzkv3du6keasznvxha7jfltqqq4hn5 ', // trailing whitespace
  'npub1lm9zfxjydk4c4sa5f3mt7f6h5qeptzkv3du6keasznvxha7jfltqqq4hn5\n', // embedded newline
];

// ── CLI ──────────────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`usage: node deliverable.npk.js <npub1…>
       node deliverable.npk.js --self
       node deliverable.npk.js --help`);
}

function selfTest() {
  const failures = [];
  for (const [npub, want] of SELF_VECTORS) {
    try {
      const got = npubToHex(npub);
      if (got !== want) failures.push(`vector mismatch for ${npub.slice(0, 16)}…: got ${got.slice(0, 16)}… want ${want.slice(0, 16)}…`);
    } catch (e) {
      failures.push(`vector threw for ${npub.slice(0, 16)}…: ${e.message}`);
    }
  }
  for (const bad of INVALID_INPUTS) {
    let threw = false;
    try { npubToHex(bad); } catch { threw = true; }
    if (!threw) failures.push(`invalid input accepted: ${JSON.stringify(bad.slice(0, 40))}`);
  }
  if (failures.length) {
    console.error('SELF-TEST FAIL:');
    for (const f of failures) console.error('  -', f);
    process.exit(1);
  }
  console.log(`SELF-TEST PASS (${SELF_VECTORS.length} valid vectors + ${INVALID_INPUTS.length} invalid inputs)`);
  process.exit(0);
}

function main() {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  }
  if (arg === '--self') {
    return selfTest();
  }
  if (!arg) {
    printHelp();
    process.exit(2);
  }
  try {
    console.log(npubToHex(arg));
    process.exit(0);
  } catch (e) {
    console.error(`decode error: ${e.message}`);
    process.exit(1);
  }
}

main();
