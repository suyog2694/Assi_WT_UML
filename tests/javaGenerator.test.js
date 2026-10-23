import assert from 'node:assert/strict';
import test from 'node:test';
import { makeJavaFiles, zipFiles } from '../src/javaGenerator.js';

const classes = [
  {
    id: 'customer',
    name: 'Customer',
    attributes: ['- id: Long'],
    methods: ['+ placeOrder(): void'],
  },
  {
    id: 'special-order',
    name: 'Special Order',
    attributes: ['+ total: double', '# reference: String', '- placedAt: LocalDate'],
    methods: ['- ship(destination: String, retries: int): boolean'],
  },
];

const relationships = [
  { id: 'inherits', from: 'special-order', to: 'customer', type: 'inheritance', label: '' },
  { id: 'association', from: 'customer', to: 'special-order', type: 'association', label: 'places · 1 to *' },
  { id: 'dependency', from: 'special-order', to: 'customer', type: 'dependency', label: 'uses' },
];

test('generates Java names, visibilities, parameters, and inheritance', () => {
  const files = makeJavaFiles(classes, relationships);
  assert.deepEqual(files.map((file) => file.name), ['Customer.java', 'SpecialOrder.java']);
  assert.match(files[0].code, /import java\.util\.List;/);
  assert.match(files[0].code, /private List<SpecialOrder> specialOrders;/);
  assert.match(files[1].code, /public class SpecialOrder extends Customer/);
  assert.match(files[1].code, /import java\.time\.LocalDate;/);
  assert.match(files[1].code, /public double total;/);
  assert.match(files[1].code, /protected String reference;/);
  assert.match(files[1].code, /private boolean ship\(String destination, int retries\)/);
  assert.match(files[1].code, /private Customer customer;/);
  assert.match(files[1].code, /\/\/ Depends on Customer/);
  assert.match(files[1].code, /return false;/);
});

test('writes a readable ZIP archive containing every generated Java file', async () => {
  const files = makeJavaFiles(classes, relationships);
  const bytes = new Uint8Array(await zipFiles(files).arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const extracted = [];
  let offset = 0;

  while (view.getUint32(offset, true) === 0x04034b50) {
    const contentLength = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    extracted.push({
      name: decoder.decode(bytes.subarray(nameStart, nameStart + nameLength)),
      code: decoder.decode(bytes.subarray(contentStart, contentStart + contentLength)),
    });
    offset = contentStart + contentLength;
  }

  const endOffset = bytes.length - 22;
  assert.equal(view.getUint32(endOffset, true), 0x06054b50);
  assert.equal(view.getUint16(endOffset + 10, true), files.length);
  assert.deepEqual(extracted, files);
});
