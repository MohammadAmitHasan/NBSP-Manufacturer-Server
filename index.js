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


const uri = "mongodb+srv://NASAH_DBA:<password>@cluster0.y9rmt.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
client.connect(err => {
    const collection = client.db("test").collection("devices");
    console.log('Database connection done')
    // perform actions on the collection object
    client.close();
});


app.get('/', (req, res) => {
    res.send('NASAH server is up and running')
})

app.listen(port, () => {
    console.log(`NASAH server is up and running on port ${port}`)
})
