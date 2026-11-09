#!/usr/bin/env node
/**
 * Persistent-login patch for the DSH desktop app (Windows).
 *
 * Problem: the desktop browser bridge hands every guest webview a throw-away,
 * in-memory session partition:
 *
 *     partition = `dsh-sidebar-browser-${randomUUID()}`;
 *
 * so chat.deepseek.com cookies die with the process and every launch asks for a
 * login again.
 *
 * Fix: rewrite that single statement to a fixed *persistent* partition:
 *
 *     partition = `persist:dsh-sidebar-browser`;
 *
 * Both statements are exactly 50 bytes, so the fix is an equal-length in-place
 * byte replacement inside `resources/app.asar` — no header or offset rewrite,
 * no re-packing, and the backup makes it fully reversible.
 *
 * Usage (run with DSH closed or open; the file is patched on disk either way,
 * the change takes effect on the next launch):
 *
 *     node patch-dsh.cjs                 # patch the default install location
 *     node patch-dsh.cjs --check         # report status only, change nothing
 *     node patch-dsh.cjs --revert        # restore from the .bak backup
 *     node patch-dsh.cjs <path-to-app.asar>
 *
 * Re-run this after every DSH update (an update replaces app.asar).
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ASAR = path.join(
  process.env.LOCALAPPDATA || '',
  'Programs',
  'DeepSeek Harness',
  'resources',
  'app.asar',
);

const NEEDLE = 'partition = `dsh-sidebar-browser-${randomUUID()}`;';
const REPLACEMENT = 'partition = `persist:dsh-sidebar-browser`;';
/** Fuse layout: 32-byte magic, 1 version byte, then fuses in Electron's order. */
const FUSE_MAGIC = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX', 'latin1');
const EMBEDDED_ASAR_INTEGRITY_INDEX = 4;
const TARGET_FILE = ['lib', 'main.js'];

function fail(message) {
  console.error('error: ' + message);
  process.exit(1);
}

function log(message) {
  console.log(message);
}

function readAsarHeader(file, size) {
  const head = Buffer.alloc(8);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, head, 0, 8, 0);
  } finally {
    fs.closeSync(fd);
  }
  const declared = head.readUInt32LE(4);
  if (declared < 8 || declared > size - 8) fail('unexpected asar header size: ' + declared);
  const headerBytes = Buffer.alloc(declared);
  const fd2 = fs.openSync(file, 'r');
  try {
    fs.readSync(fd2, headerBytes, 0, declared, 8);
  } finally {
    fs.closeSync(fd2);
  }
  const start = headerBytes.indexOf(0x7b); // '{'
  const end = headerBytes.lastIndexOf(0x7d); // '}'
  if (start < 0 || end <= start) fail('asar header is not JSON');
  const header = JSON.parse(headerBytes.toString('utf8', start, end + 1));
  return { header, dataBase: 8 + declared };
}

function findEntry(header, segments) {
  let node = header;
  for (const segment of segments) {
    const files = node === undefined || node === null ? undefined : node.files;
    if (files === undefined || files === null || files[segment] === undefined) return undefined;
    node = files[segment];
  }
  return node;
}

function findMagic(filePath) {
  const stat = fs.statSync(filePath);
  const fd = fs.openSync(filePath, 'r');
  try {
    const chunkSize = 8 * 1024 * 1024;
    const chunk = Buffer.alloc(chunkSize + FUSE_MAGIC.length);
    let position = 0;
    while (position < stat.size) {
      const read = fs.readSync(fd, chunk, 0, chunkSize, position);
      if (read <= 0) break;
      const at = chunk.subarray(0, read).indexOf(FUSE_MAGIC);
      if (at >= 0) return position + at;
      position += read;
    }
    return -1;
  } finally {
    fs.closeSync(fd);
  }
}

function locateExe(asarPath) {
  const dir = path.dirname(asarPath);
  const root = path.dirname(dir);
  let names;
  try {
    names = fs.readdirSync(root);
  } catch (error) {
    return undefined;
  }
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.exe')) continue;
    const candidate = path.join(root, name);
    let stat;
    try {
      stat = fs.statSync(candidate);
    } catch (error) {
      continue;
    }
    if (!stat.isFile() || stat.size < 50 * 1024 * 1024) continue;
    try {
      if (findMagic(candidate) >= 0) return candidate;
    } catch (error) {
      /* keep looking */
    }
  }
  return undefined;
}

function checkFuses(exePath) {
  if (exePath === undefined) {
    log('warning: could not locate the DSH exe; skipping the fuse check.');
    return;
  }
  const stat = fs.statSync(exePath);
  const fd = fs.openSync(exePath, 'r');
  let offset = -1;
  let fuses;
  try {
    const chunkSize = 16 * 1024 * 1024;
    const chunk = Buffer.alloc(chunkSize);
    let position = 0;
    while (position < stat.size) {
      const read = fs.readSync(fd, chunk, 0, chunkSize, position);
      if (read <= 0) break;
      const at = chunk.subarray(0, read).indexOf(FUSE_MAGIC);
      if (at >= 0) {
        offset = position + at;
        const tail = Buffer.alloc(32 + 2 + 9);
        fs.readSync(fd, tail, 0, tail.length, offset);
        fuses = tail.subarray(34, 43);
        break;
      }
      position += read - (FUSE_MAGIC.length - 1);
    }
  } finally {
    fs.closeSync(fd);
  }
  if (offset < 0 || fuses === undefined) {
    log('warning: Electron fuse header not found in ' + exePath + '; skipping the fuse check.');
    return;
  }
  const byte = fuses[EMBEDDED_ASAR_INTEGRITY_INDEX];
  const enabled = byte === 0x31; // '1'
  log(
    'fuse check: EnableEmbeddedAsarIntegrityValidation is '
      + (enabled ? 'ENABLED (0x31)' : 'disabled (0x' + byte.toString(16) + ')')
      + ' at offset ' + (offset + 34 + EMBEDDED_ASAR_INTEGRITY_INDEX),
  );
  if (enabled) {
    fail(
      'this build verifies app.asar integrity, so an in-place patch would stop DSH from starting. '
        + 'Nothing was changed.',
    );
  }
}

function patch(asarPath) {
  const stat = fs.statSync(asarPath);
  const { header, dataBase } = readAsarHeader(asarPath, stat.size);
  const entry = findEntry(header, TARGET_FILE);
  if (entry === undefined) fail('entry not found in asar: ' + TARGET_FILE.join('/'));
  if (entry.unpacked === true) fail('the target file is unpacked; this patch expects a packed entry');
  // Newer asar headers store offsets/sizes as decimal strings to stay within
  // JSON number-safety rules, so coerce before doing any arithmetic.
  const entryOffset = Number(entry.offset);
  const entrySize = Number(entry.size);
  if (!Number.isSafeInteger(entryOffset) || !Number.isSafeInteger(entrySize)) {
    fail('target entry has an unusable offset/size: ' + JSON.stringify({ offset: entry.offset, size: entry.size }));
  }
  const fileStart = dataBase + entryOffset;
  if (fileStart + entrySize > stat.size) fail('target entry lies outside the archive');
  const bytes = Buffer.alloc(entrySize);
  const fd = fs.openSync(asarPath, 'r');
  try {
    fs.readSync(fd, bytes, 0, entrySize, fileStart);
  } finally {
    fs.closeSync(fd);
  }
  if (NEEDLE.length < REPLACEMENT.length) fail('the replacement does not fit into the original statement');
  const occurrences = [];
  let at = bytes.indexOf(NEEDLE);
  while (at >= 0) {
    occurrences.push(at);
    at = bytes.indexOf(NEEDLE, at + 1);
  }
  const already = (() => {
    const padded = REPLACEMENT + ' '.repeat(NEEDLE.length - REPLACEMENT.length);
    let index = bytes.indexOf(padded);
    let count = 0;
    while (index >= 0) {
      count += 1;
      index = bytes.indexOf(padded, index + 1);
    }
    return count;
  })();

  log('asar:        ' + asarPath);
  log('target:      ' + TARGET_FILE.join('/') + ' (' + entrySize + ' bytes at ' + fileStart + ')');
  log('needle hits: ' + occurrences.length + (occurrences.length === 1 ? ' at +' + occurrences[0] : ''));
  log('patched hits:' + ' ' + already);

  if (occurrences.length === 0 && already === 1) {
    log('status:      already patched — nothing to do.');
    return;
  }
  if (occurrences.length !== 1) {
    fail('expected exactly one occurrence of the throw-away partition statement');
  }

  const backup = asarPath + '.dsh-deepseek-web.bak';
  if (!fs.existsSync(backup)) {
    log('backup:      copying app.asar -> ' + backup + ' (this takes a few seconds)');
    fs.copyFileSync(asarPath, backup);
  } else {
    log('backup:      reusing existing ' + backup);
  }

  const padded = Buffer.from(REPLACEMENT + ' '.repeat(NEEDLE.length - REPLACEMENT.length), 'latin1');
  const out = fs.openSync(asarPath, 'r+');
  try {
    const written = fs.writeSync(out, padded, 0, padded.length, fileStart + occurrences[0]);
    if (written !== padded.length) fail('short write');
  } finally {
    fs.closeSync(out);
  }

  const verify = Buffer.alloc(entrySize);
  const fd3 = fs.openSync(asarPath, 'r');
  try {
    fs.readSync(fd3, verify, 0, entry.size, fileStart);
  } finally {
    fs.closeSync(fd3);
  }
  const after = stat.size;
  if (after !== fs.statSync(asarPath).size) fail('file size changed unexpectedly');
  if (verify.indexOf(padded) !== occurrences[0]) fail('read-back does not show the patched statement');
  let diff = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] !== verify[i]) diff += 1;
  }
  if (diff !== 0) {
    log('note:        ' + diff + ' byte(s) differ inside the target file (expected <= ' + NEEDLE.length + ')');
  }
  log('status:      patched. Restart DeepSeek Harness; the web login now survives restarts.');
  log('rollback:    copy "' + backup + '" back over app.asar');
}

function revert(asarPath) {
  const backup = asarPath + '.dsh-deepseek-web.bak';
  if (!fs.existsSync(backup)) fail('no backup found at ' + backup);
  log('restoring ' + backup + ' -> ' + asarPath);
  fs.copyFileSync(backup, asarPath);
  log('status:      reverted. Restart DeepSeek Harness.');
}

function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const asarPath = positional.length > 0 ? path.resolve(positional[0]) : DEFAULT_ASAR;
  if (!fs.existsSync(asarPath)) fail('app.asar not found at ' + asarPath);
  if (flags.has('--revert')) {
    revert(asarPath);
    return;
  }
  checkFuses(locateExe(asarPath));
  if (flags.has('--check')) {
    const stat = fs.statSync(asarPath);
    const { header, dataBase } = readAsarHeader(asarPath, stat.size);
    const entry = findEntry(header, TARGET_FILE);
    if (entry === undefined) fail('entry not found in asar: ' + TARGET_FILE.join('/'));
    const entryOffset = Number(entry.offset);
    const entrySize = Number(entry.size);
    if (!Number.isSafeInteger(entryOffset) || !Number.isSafeInteger(entrySize)) {
      fail('target entry has an unusable offset/size: ' + JSON.stringify({ offset: entry.offset, size: entry.size }));
    }
    const fileStart = Number(dataBase) + entryOffset;
    const bytes = Buffer.alloc(entrySize);
    const fd = fs.openSync(asarPath, 'r');
    try {
      fs.readSync(fd, bytes, 0, entrySize, fileStart);
    } finally {
      fs.closeSync(fd);
    }
    const padded = Buffer.from(REPLACEMENT + ' '.repeat(NEEDLE.length - REPLACEMENT.length), 'latin1');
    const needed = bytes.indexOf(NEEDLE) >= 0;
    const done = bytes.indexOf(padded) >= 0;
    log('status:      ' + (done ? 'patched' : needed ? 'not patched' : 'unknown layout (neither statement found)'));
    return;
  }
  patch(asarPath);
}

main();
