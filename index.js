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


const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    // Check the token validity
    jwt.verify(token, process.env.SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next()
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.y9rmt.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const partsCollection = client.db('NBSP-database').collection('parts');

        // All Parts get API
        app.get('/parts', async (req, res) => {
            const size = parseInt(req.query.size);
            const parts = await partsCollection.find({}).limit(size).toArray();
            res.send(parts);
        })

        // Single part get API
        app.get('/parts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await partsCollection.findOne(query)
            res.send(result)
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
