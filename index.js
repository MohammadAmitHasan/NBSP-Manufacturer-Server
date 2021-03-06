const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_APIKEY);


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
        const userCollection = client.db('NBSP-database').collection('user');
        const bookingCollection = client.db('NBSP-database').collection('booking');
        const paymentCollection = client.db('NBSP-database').collection('payments');
        const reviewCollection = client.db('NBSP-database').collection('review');

        // Middleware to verify admin
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        }

        // Check admin or not
        app.get('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin';
            res.send(isAdmin)
        })

        // Get all users
        app.get('/allUsers', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {}
            const users = await userCollection.find(query).sort({ '_id': -1 }).toArray();
            res.send(users);
        })

        // Make admin role
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // Shipment API
        app.patch('/shipped/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'Shipped',
                }
            }
            const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);
            res.send(updatedBooking);
        })


        // Stripe
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { totalPrice } = req.body;
            // Convert in paisa
            const amount = totalPrice * 100;
            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: "usd",
                payment_method_types: [
                    "card"
                ],
            });
            res.send({ clientSecret: paymentIntent.client_secret, })
        })

        // Payment update
        app.patch('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    status: 'Pending Delivery',
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);
            res.send(updatedBooking);
        })

        // Delete booking 
        app.delete('/booking/:id', verifyJWT, async (req, res) => {
            const email = req.query.client;
            const productId = req.params.id;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === email) {
                const product = await bookingCollection.findOne({ _id: ObjectId(productId) })
                if (!product.paid) {
                    const result = await bookingCollection.deleteOne({ _id: ObjectId(productId) })
                    res.send(result)
                }
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        })

        app.delete('/part/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await partsCollection.deleteOne(query);
            res.send(result);
        })


        // All Parts get API
        app.get('/parts', async (req, res) => {
            const size = parseInt(req.query.size);
            const parts = await partsCollection.find({}).limit(size).sort({ '_id': -1 }).toArray();
            res.send(parts);
        })

        //Add part API
        app.post('/parts', verifyJWT, verifyAdmin, async (req, res) => {
            const part = req.body;
            const result = await partsCollection.insertOne(part);
            res.send(result);
        })

        // Single part get API
        app.get('/parts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await partsCollection.findOne(query)
            res.send(result)
        })

        // Store user data
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);

            // Generate a jwt
            const token = jwt.sign({ email: email }, process.env.SECRET, {
                expiresIn: '1d',
            })
            res.send({ result, token });
        })

        // Get single user data API
        app.get('/user/:id', verifyJWT, async (req, res) => {
            const email = req.params.id;
            const user = await userCollection.findOne({ email: email })
            res.send(user);
        })

        // Update user data
        app.put('/user/:id', verifyJWT, async (req, res) => {
            const email = req.params.id;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.send(result)
        })

        app.post('/booking', verifyJWT, async (req, res) => {
            const booking = req.body;
            const email = booking.email;
            const decodedEmail = req.decoded.email;

            // Check the email with decoded email
            if (decodedEmail === email) {
                const productId = booking.productId;
                const product = await partsCollection.findOne({ _id: ObjectId(productId) })
                const totalPrice = product.price * parseInt(booking.quantity);

                booking.totalPrice = totalPrice;
                booking.status = 'Payment Pending';
                const result = await bookingCollection.insertOne(booking);
                res.send({ success: true, result })
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        })

        app.get('/myOrders', verifyJWT, async (req, res) => {
            const client = req.query.client;
            const decodedEmail = req.decoded.email;

            // Check the email with decoded email
            if (decodedEmail === client) {
                const query = { email: client };
                const bookings = await bookingCollection.find(query).sort({ '_id': -1 }).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        })

        // Get all orders API
        app.get('/allOrders', verifyJWT, verifyAdmin, async (req, res) => {
            const bookings = await bookingCollection.find({}).sort({ '_id': -1 }).toArray();
            return res.send(bookings);
        })

        // payment required API
        // Load Specific booking data API
        app.get('/booking/:id', async (req, res) => {
            const booking = req.params.id;
            const query = { _id: ObjectId(booking) }
            const result = await bookingCollection.findOne(query);
            res.send(result)
        })

        // Review APIs
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewCollection.find({}).sort({ '_id': -1 }).toArray();
            res.send(reviews);
        })

        app.post('/reviews', verifyJWT, async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
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
