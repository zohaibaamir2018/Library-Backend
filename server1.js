// Import dependencies
const express = require('express');
const { MongoClient, ObjectID } = require('mongodb');
require('dotenv').config(); // Load environment variables from .env

// Create an Express.js instance
const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// Set the port for the server
app.set('port', process.env.PORT || 3000);

// CORS Middleware
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    next();
});

// Logger Middleware
function logger(req, res, next) {
    const method = req.method;
    const url = req.url;
    const timestamp = new Date();

    console.log(`[${timestamp}] ${method} request to ${url}`);

    res.on('finish', () => {
        console.log(`[${timestamp}] Response status: ${res.statusCode}`);
    });

    next();
}

// Use the logger middleware
app.use(logger);

// MongoDB connection
const mongoURI = process.env.MONGO_URI; // Load MongoDB URI from .env
let db;

MongoClient.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
        db = client.db('webstore'); // Connect to the database 'webstore'
        console.log('Connected to MongoDB');
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB', err);
    });

// Display a message for the root path to show that the API is working
app.get('/', (req, res) => {
    res.send('API is running. Use /lessons or /orders.');
});

// Retrieve all lessons from the 'lessons' collection
app.get('/lessons', async (req, res) => {
    try {
        const lessons = await db.collection("lessons").find({}).toArray();
        res.status(200).json(lessons);
    } catch (error) {
        res.status(500).json({ error: "Error fetching lessons" });
    }
});

// Add a new lesson to the 'lessons' collection
app.post('/lessons', async (req, res) => {
    const { name, image, price, availableInventory, location, rating } = req.body;
    if (!name || !image || !price || !availableInventory || !location || !rating) {
        return res.status(400).send("Missing required fields");
    }

    try {
        const newLesson = { name, image, price, availableInventory, location, rating };
        const result = await db.collection("lessons").insertOne(newLesson);
        res.status(201).json(result.ops[0]);
    } catch (error) {
        res.status(500).json({ error: "Failed to add lesson" });
    }
});

// Fetch a specific lesson by ID
app.get('/lessons/:id', async (req, res) => {
    try {
        const lesson = await db.collection("lessons").findOne({ _id: new ObjectID(req.params.id) });
        if (!lesson) return res.status(404).json({ error: "Lesson not found" });
        res.status(200).json(lesson);
    } catch (error) {
        res.status(500).json({ error: "Error fetching lesson" });
    }
});

// Update the availableInventory for a lesson by ID
app.put('/lessons/:id', async (req, res) => {
    const { availableInventory } = req.body;

    if (availableInventory === undefined) {
        return res.status(400).json({ error: "Missing availableInventory" });
    }

    try {
        const result = await db.collection("lessons").updateOne(
            { _id: new ObjectID(req.params.id) },
            { $set: { availableInventory } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Lesson not found" });
        }
        res.status(200).json({ message: "Lesson updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error updating lesson" });
    }
});

// Place an order
app.post('/orders', async (req, res) => {
    const { lessonId, quantity, customerName, customerEmail } = req.body;

    if (!lessonId || !quantity || !customerName || !customerEmail) {
        return res.status(400).send("Missing required fields");
    }

    try {
        const lesson = await db.collection("lessons").findOne({ _id: new ObjectID(lessonId) });

        if (!lesson || lesson.availableInventory < quantity) {
            return res.status(400).send("Not enough inventory");
        }

        // Insert order into orders collection
        const order = { lessonId, quantity, customerName, customerEmail };
        await db.collection("orders").insertOne(order);

        // Update lesson inventory
        await db.collection("lessons").updateOne(
            { _id: new ObjectID(lessonId) },
            { $inc: { availableInventory: -quantity } }
        );

        res.status(201).send("Order placed successfully");
    } catch (error) {
        res.status(500).send("Failed to place order");
    }
});

// Start the server
app.listen(app.get('port'), () => {
    console.log(`Express.js server running at http://localhost:${app.get('port')}`);
});
