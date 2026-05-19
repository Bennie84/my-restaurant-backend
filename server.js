// const express = require("express");
// // const mongoose = require("mongoose");
// const cors = require("cors");
// const axios = require("axios");
// require("dotenv").config();

// const app = express();

// app.use(cors());
// app.use(express.json());

// // MongoDB connection and order persistence were removed to restore the previous backend structure.
// // The admin dashboard and order storage endpoints are disabled, but the file structure remains.

// //Verify payment
// app.post("/verify-payment", async (req, res) => {
//   const { reference, email, amount, items } = req.body;

//   try {
//     console.log("Received payment verification request:", {
//       reference,
//       email,
//       amount,
//     });

//     //Verify payment with Paystack
//     const response = await axios.get(
//       `https://api.paystack.co/transaction/verify/${reference}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         },
//       },
//     );

//     console.log("Paystack response:", response.data);
//     const paymentData = response.data.data;

//     if (paymentData.status === "success") {
//       console.log("Payment verified successfully");

//       res.json({
//         success: true,
//         message: "Payment verified",
//       });
//     } else {
//       console.log("Payment verification failed. Status:", paymentData.status);
//       res.json({
//         success: false,
//         message: "Payment verification failed",
//       });
//     }
//   } catch (error) {
//     console.error("Error in verify-payment:", error.message);
//     console.error("Error details:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// });

// // Admin dashboard and order management routes were removed to restore the original backend structure.
// // The files remain for structure, but those endpoints are no longer active.

// //Start server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`\n✅ Server running on port ${PORT}`);
//   console.log(`📍 API available at http://localhost:${PORT}`);
//   if (!process.env.MONGODB_URI) {
//     console.log(`\n⚠️  WARNING: MONGODB_URI not found in .env`);
//     console.log(`Please add it: MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname`);
//   }
//   console.log("");
// });


const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();

// Middleware
app.use(
  cors({
    origin: "https://restaurant-frontend-plum-beta.vercel.app",
  }),
);
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("MongoDB error:", err.message));

// =====================
// SCHEMAS
// =====================

// Order Schema
const orderSchema = new mongoose.Schema({
  reference: String,
  email: String,
  amount: Number,
  items: Array,
  status: {
    type: String,
    default: "confirmed",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Order = mongoose.model("Order", orderSchema);

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Admin = mongoose.model("Admin", adminSchema);

// =====================
// MIDDLEWARE
// =====================

// JWT verification middleware
function verifyToken(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// =====================
// ROUTES
// =====================

// Verify payment and save order
app.post("/verify-payment", async (req, res) => {
  const { reference, email, items, amount } = req.body;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    const paymentData = response.data.data;

    if (paymentData.status === "success") {
      const order = new Order({
        reference,
        email,
        amount,
        items,
        status: "confirmed",
      });

      await order.save();

      res.json({
        success: true,
        message: "Payment verified and order saved!",
        orderId: order._id,
      });
    } else {
      res.json({
        success: false,
        message: "Payment verification failed",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Get order by ID
app.get("/order/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// ADMIN ROUTES
// =====================

// Create first admin (run once then disable)
app.post("/admin/setup", async (req, res) => {
  try {
    const existingAdmin = await Admin.findOne();
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = new Admin({
      username,
      password: hashedPassword,
    });

    await admin.save();
    res.json({ success: true, message: "Admin created successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Admin login
app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      success: true,
      token,
      message: "Login successful!",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get all orders (protected)
app.get("/orders", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Update order status (protected)
app.patch("/orders/:id", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get dashboard stats (protected)
app.get("/admin/stats", verifyToken, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: "confirmed" });
    const preparingOrders = await Order.countDocuments({ status: "preparing" });
    const deliveredOrders = await Order.countDocuments({ status: "delivered" });

    const revenueResult = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: today },
    });

    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        preparingOrders,
        deliveredOrders,
        totalRevenue,
        todayOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
