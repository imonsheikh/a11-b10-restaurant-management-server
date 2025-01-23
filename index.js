require('dotenv').config()
const express = require('express')
const cors = require('cors') 
const jwt = require('jsonwebtoken') 
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 9000
const app = express() 

//Middleware 
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true, 
    optionalSuccessStatus: 200
}
app.use(cors(corsOptions))
app.use(express.json()) //For solved req.body undefined problem 


//Main Server start
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.le9rg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db('resManage-db')
    const myFoodsCollection = db.collection('my-foods')
    const myOrders = db.collection('my-orders') 

    //1. Save OR ADD a food data in db
    app.post('/add-food', async(req,res) => {
        const foodData = req.body 
        const result = await myFoodsCollection.insertOne(foodData)
        res.send(result)
    }) 
    // 2.Get all foods 
    app.get('/all-foods', async(req,res) => {
        const search = req.query.search 
        // console.log(search);
         let query = {foodName: {
            $regex: search,
            $options: 'i'
         }}
 
        const result = await myFoodsCollection.find(query).toArray()
        res.send(result)
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close(); 
  }
}
run().catch(console.dir);
//Main Server end

//Making server 
app.get('/', (req, res) => {
    res.send('Restaurant server is running');
    
})

//For execute this server for listen 
app.listen(port, () => {
    console.log(`Restaurant server is running on port ${port}`);
    
})