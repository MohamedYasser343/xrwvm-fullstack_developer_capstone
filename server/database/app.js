const fs = require('node:fs');
const path = require('node:path');

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');

const Dealerships = require('./dealership');
const Reviews = require('./review');

const port = Number(process.env.PORT || 3030);
const mongoUrl = process.env.MONGO_URL || 'mongodb://mongo_db:27017/dealershipsDB';

function createApp({ Dealerships: DealershipModel, Reviews: ReviewModel }) {
  const app = express();

  app.use(cors());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get('/', (req, res) => {
    res.send('Welcome to the Mongoose API');
  });

  app.get('/fetchReviews', async (req, res) => {
    try {
      res.json(await ReviewModel.find());
    } catch (error) {
      res.status(500).json({ error: 'Error fetching documents' });
    }
  });

  app.get('/fetchReviews/dealer/:id', async (req, res) => {
    try {
      const reviews = await ReviewModel.find({ dealership: Number(req.params.id) });
      res.json([...reviews].sort((first, second) => second.id - first.id));
    } catch (error) {
      res.status(500).json({ error: 'Error fetching documents' });
    }
  });

  app.get('/fetchDealers', async (req, res) => {
    try {
      res.json(await DealershipModel.find());
    } catch (error) {
      res.status(500).json({ error: 'Error fetching documents' });
    }
  });

  app.get('/fetchDealers/:state', async (req, res) => {
    try {
      const filter = req.params.state === 'All' ? {} : { state: req.params.state };
      res.json(await DealershipModel.find(filter));
    } catch (error) {
      res.status(500).json({ error: 'Error fetching documents' });
    }
  });

  app.get('/fetchDealer/:id', async (req, res) => {
    try {
      res.json(await DealershipModel.find({ id: Number(req.params.id) }));
    } catch (error) {
      res.status(500).json({ error: 'Error fetching documents' });
    }
  });

  app.post('/insert_review', async (req, res) => {
    try {
      const documents = await ReviewModel.find().sort({ id: -1 }).limit(1);
      const review = new ReviewModel({
        id: documents.length === 0 ? 1 : documents[0].id + 1,
        name: req.body.name,
        dealership: req.body.dealership,
        review: req.body.review,
        purchase: req.body.purchase,
        purchase_date: req.body.purchase_date,
        car_make: req.body.car_make,
        car_model: req.body.car_model,
        car_year: req.body.car_year,
      });

      res.json(await review.save());
    } catch (error) {
      res.status(500).json({ error: 'Error inserting review' });
    }
  });

  return app;
}

async function seedCollection(Model, documents) {
  if (await Model.countDocuments() === 0) {
    await Model.insertMany(documents);
  }
}

async function seedDatabase({
  ReviewModel = Reviews,
  DealershipModel = Dealerships,
} = {}) {
  const reviews = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'reviews.json'), 'utf8'),
  ).reviews;
  const dealerships = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'dealerships.json'), 'utf8'),
  ).dealerships;

  await Promise.all([
    seedCollection(ReviewModel, reviews),
    seedCollection(DealershipModel, dealerships),
  ]);
}

async function startServer() {
  await mongoose.connect(mongoUrl);
  await seedDatabase();

  return createApp({ Dealerships, Reviews }).listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start the Mongoose API:', error);
    process.exitCode = 1;
  });
}

module.exports = { createApp, seedDatabase, startServer };
