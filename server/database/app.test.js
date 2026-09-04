const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const dealerships = require('./data/dealerships.json').dealerships;
const reviews = require('./data/reviews.json').reviews;
const { createApp, seedDatabase } = require('./app');

function modelFor(documents) {
  return {
    async find(filter = {}) {
      return documents.filter((document) =>
        Object.entries(filter).every(([key, value]) => document[key] === value),
      );
    },
  };
}

let baseUrl;
let server;

before(async () => {
  const app = createApp({
    Dealerships: modelFor(dealerships),
    Reviews: modelFor(reviews),
  });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200);
  return response.json();
}

test('GET /fetchReviews/dealer/29 returns only dealer 29 reviews', async () => {
  const body = await getJson('/fetchReviews/dealer/29');

  assert.ok(body.length > 0);
  assert.ok(body.every((review) => review.dealership === 29));
});

test('GET /fetchReviews/dealer/:id returns newest reviews first', async () => {
  const body = await getJson('/fetchReviews/dealer/2');

  assert.deepEqual(body.map((review) => review.id), [46, 19]);
});

test('GET /fetchDealers returns every dealership', async () => {
  const body = await getJson('/fetchDealers');

  assert.equal(body.length, dealerships.length);
  assert.deepEqual(body[0], dealerships[0]);
});

test('GET /fetchDealer/3 returns dealer 3 as an array', async () => {
  const body = await getJson('/fetchDealer/3');

  assert.deepEqual(body, dealerships.filter((dealer) => dealer.id === 3));
});

test('GET /fetchDealers/Kansas returns only Kansas dealerships', async () => {
  const body = await getJson('/fetchDealers/Kansas');

  assert.ok(body.length > 0);
  assert.ok(body.every((dealer) => dealer.state === 'Kansas'));
});

test('GET /fetchDealers/All returns every dealership', async () => {
  const body = await getJson('/fetchDealers/All');

  assert.equal(body.length, dealerships.length);
});

test('seedDatabase preserves populated collections', async () => {
  const model = {
    countDocuments: async () => 1,
    insertMany: async () => assert.fail('must not replace existing records'),
  };

  await seedDatabase({ ReviewModel: model, DealershipModel: model });
});

test('seedDatabase initializes empty collections', async () => {
  const inserted = [];
  const model = {
    countDocuments: async () => 0,
    insertMany: async (documents) => inserted.push(documents),
  };

  await seedDatabase({ ReviewModel: model, DealershipModel: model });

  assert.equal(inserted.length, 2);
  assert.ok(inserted.every((documents) => documents.length > 0));
});
