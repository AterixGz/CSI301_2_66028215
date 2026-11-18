import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZipArchive, crc32 } from './zipBuilder';

test('crc32 computes standard IEEE 802.3 checksum', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc32(bytes), 0xcbf43926);
});

test('buildZipArchive produces valid PKZIP headers and entry count', () => {
  const enc = new TextEncoder();
  const zip = buildZipArchive([
    { name: 'hello.txt', data: enc.encode('hello world') },
    { name: 'dir/test.txt', data: enc.encode('escrow') },
  ]);

  const view = new DataView(zip.buffer);
  // Local file header signature PK\x03\x04
  assert.equal(view.getUint32(0, true), 0x04034b50);
  // EOCD signature at last 22 bytes
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
  // Total entries in EOCD
  assert.equal(view.getUint16(zip.length - 12, true), 2);
});
