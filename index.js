const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


// Middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.y9rmt.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const partsCollection = client.db('NBSP-database').collection('parts');

        // Parts get API
        app.get('/parts', async (req, res) => {
            const size = parseInt(req.query.size);
            const parts = await partsCollection.find({}).limit(size).toArray();
            res.send(parts);
        })
    }
    finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('NASAH server is up and running')
})

app.listen(port, () => {
    console.log(`NASAH server is up and running on port ${port}`)
})
