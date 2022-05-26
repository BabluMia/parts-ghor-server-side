const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
require("dotenv").config();

// middlewere
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.USER_PASS}@cluster0.uxvra.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const productCollection = client.db("PartsGhor").collection("products");
    const userCollection = client.db("PartsGhor").collection("users");
    const reviewCollection = client.db("PartsGhor").collection("reviews");
    const orderCollection = client.db("PartsGhor").collection("orders");

    console.log("connect to partsGhor");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded?.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden access" });
      }
    };

    // payment intent

    app.post('/create-payment-intent', verifyJWT, async(req, res) =>{
      const service = req.body;
      const price = service.price;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency: 'usd',
        payment_method_types:['card']
      });
      res.send({clientSecret: paymentIntent.client_secret})
    });

    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productCollection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    });
    // post product
    app.post("/products", async (req, res) => {
      const product = req.body;

      const result = await productCollection.insertOne(product);
      return res.send({ success: true, result });
    });
    // update product
    app.put("/product/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body.quantity;
      const filter = { _id: ObjectId(id) };
      // const options = { upsert: true };
      const updatedDoc = {
        $set: {
          quantity: data,
        },
      };
      const result = await productCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = await productCollection.findOne(query);
      res.send(product);
    });

    //---------------- get  all user-----------------
    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    //-------------------------- user collection----------------
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      // user
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET);
      res.send({ result, token });
    });

    // ---------------------admin-------------------
    app.get("/admin/:email",verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put("/user/admin/:email",verifyJWT,verifyAdmin,  async (req, res) => {
      //verifyJWT, verifyAdmin,
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // -------------------------add review -----------------------------
    app.post("/reviews", async (req, res) => {
      const result = await reviewCollection.insertOne(req.body);
      // console.log(req.body);
      res.send(result);
      // console.log(result);
    });
    // get review
    app.get("/reviews", async (req, res) => {
      const reviews = await reviewCollection.find().toArray();
      res.send(reviews);
    });
    // order Collection
    app.post("/orders", async (req, res) => {
      const result = await orderCollection.insertOne(req.body);
      res.send(result);
    });
    app.get("/orders", async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });
    app.get("/order",verifyJWT, async (req, res) => {
      const email = req.query.email;
      const authorization = req.headers.authorization;
      // console.log(authorization);
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const query = { email: email };
        const cursor = orderCollection.find(query);
        const orders = await cursor.toArray();
        res.send(orders);
      }else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    });
    // order delete api
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.json(result);
    });
  } finally {
  }
}

// call run function
run().catch(console.dir);

// test server home route
app.get("/", (req, res) => {
  res.send(" Server Conected . Test Done!!");
});
// listening port
app.listen(port, () => {
  console.log("Parts Surver Running In", port);
});
