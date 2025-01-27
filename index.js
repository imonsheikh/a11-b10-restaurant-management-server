require('dotenv').config()
const express = require('express')
const cors = require('cors') 
const jwt = require('jsonwebtoken') 
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 9000
const app = express() 

//Middleware 
const corsOptions = {
    origin: [
      'http://localhost:5173',
       'http://localhost:5174',
      'https://restaurant-management-399f0.web.app'
    ],
    credentials: true, 
    optionalSuccessStatus: 200
}
app.use(cors(corsOptions))
app.use(express.json()) //For solved req.body undefined problem 
app.use(cookieParser()) //Parse the data of browse cookie


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

//JWT Verify Token(As Middleware). We Can use this into the middleware area
const verifyToken = (req, res, next) => {
  // console.log('Hello I am a middleware');
const token = req.cookies?.token 
//Only token check it is exist or not
if(!token) return res.status(401).send({message: 'UnAuthorized Access for Token missing'}) 
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    //Check Error: token exist but valid or not checking
    if(err){
      return res.status(401).send({message: 'UnAuthorized Access for Invalid token'})
    } 
   req.user = decoded //Create new Property user and set the value of decoded
  }) 
  next()
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    const db = client.db('resManage-db')
    const myFoodsCollection = db.collection('my-foods')
    const myOrdersCollection = db.collection('my-orders') 

    //0.Generate JWT(JSON Web token)
    app.post('/jwt', async(req, res) => {
      const email = req.body 
      //Create token 
      const token = jwt.sign(email, process.env.SECRET_KEY, {expiresIn: '365d'})//secret_key is a static key for only server but email will be dynamic 
      // console.log(token);
      // res.send(token) //For direct response to client 
      res.cookie('token', token, {//For security issue pass some configuration
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      })
      .send({success: true})
    })
    // 0.1 Logout || clear cookie from browser 
    app.get('/logout', async(req, res) => {
      res.clearCookie('token', {
        maxAge: 0, //As we did not transfer cookie 
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      })
      .send({success: true}) 
    })

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

    //3. Get a single Food data by id from db ==>findOne() 
    app.get('/food/:id', async(req, res) => {
     const id = req.params.id 
     const query = {_id: new ObjectId(id)}
     const result = await myFoodsCollection.findOne(query) 
     res.send(result)
    }) 
    // 4. Add food purchase 
    app.post('/add-food-purchase', async(req, res) => {
      const purchaseData = req.body 
      // console.log(purchaseData); 
       
       //a Save Or create myOrdersCollection
      const result = await myOrdersCollection.insertOne(purchaseData)
        //b. Increase purchaseCount 
        const filter = {_id: new ObjectId(purchaseData.purchaseId)}
        const updated = {
          $inc: {
            purchaseCount: 1
          }
        } 
        const updatePurchaseCount = await myFoodsCollection.updateOne(filter, updated)
      res.send(result)
    })
    //5. GET all foods posted by specific user ==> query + email + find().toArray()
    app.get('/foods/:email', verifyToken, async(req, res) => {
       const email = req.params.email
       const decodedEmail = req.user?.email

       // console.log('Email from Token-->', decodedEmail);
       // console.log('Email from params-->', email);
       //Check email and decodededEmail 
       if(decodedEmail !== email) return res.status(401).send({message: 'UnAuthorized Access Email did not matched'}) 

        const query = {
          'buyer.email': email
        } 
        const result = await myFoodsCollection.find(query).toArray()
        res.send(result)
    }) 
    //6.Update a FoodData in DB ==> updateOne()
    app.put('/update-food/:id', async(req, res) => {
      const id = req.params.id 
      const foodData = req.body 

      const filter = {_id: new ObjectId(id)} //OR
      // const query = {_id: new ObjectId(id)}
      const updated = {
        $set: foodData
      }
      const options = {upsert: true} 
      
      const result = await myFoodsCollection.updateOne(filter, updated, options)
      res.send(result) 
    })

    //7.Get All Order data 
    app.get('/orders/:email',verifyToken, async(req,res) => {
      const email = req.params.email
      const decodedEmail = req.user?.email 

      //Validate email 
      if(decodedEmail !== email) return res.status(401).send({message: 'UnAuthorized Access for email'}) 
      
      const query = {email: email}
      const result = await myOrdersCollection.find(query).toArray()
      res.send(result)
    })

    //8. Order delete 
    app.delete('/order/:id', verifyToken, async(req, res) => {
      const id = req.params.id 
      const query = {_id: new ObjectId(id)} 

      const result = await myOrdersCollection.deleteOne(query)
      res.send(result)
    })
    // 9.foods
    app.get('/foods', async (req, res) => {
      const result = await myFoodsCollection.find().sort({purchaseCount: - 1}).limit(6).toArray()
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