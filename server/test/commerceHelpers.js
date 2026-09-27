import { XRW, validProduct } from './helpers.js';

export const ADDRESS = {
  fullName: 'Ana Rao',
  phone: '9876543210',
  line1: '12 Lake View Road',
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: '500033',
};

export const sizedProduct = (overrides = {}) =>
  validProduct({
    sizeType: 'sized',
    sizes: [
      { label: 'S', stock: 3 },
      { label: 'M', stock: 1 },
    ],
    ...overrides,
  });

export async function addAddress(agent, overrides = {}) {
  const res = await agent
    .post('/api/users/me/addresses')
    .set(XRW)
    .send({ ...ADDRESS, ...overrides });
  if (res.status !== 201 && res.status !== 200) throw new Error(`address: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.address._id;
}

let n = 0;
export const key = () => `test-key-${Date.now()}-${++n}`;

export const place = (agent, body) =>
  agent
    .post('/api/orders')
    .set(XRW)
    .send({ source: 'cart', paymentMethod: 'cod', idempotencyKey: key(), ...body });

export async function stockOf(Product, id, label) {
  const p = await Product.findById(id).lean();
  const row = p.sizes.find((s) => s.label === label);
  return { stock: row.stock, reserved: row.reserved || 0, inStock: p.inStock, totalStock: p.totalStock };
}
