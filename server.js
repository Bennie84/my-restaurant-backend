const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();

//Middleware
app.use(
  cors({
    origin: "https://restaurant-frontend-plum-beta.vercel.app"
  }),
);
app.use(express.json());

//Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000, 
    family: 4,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB error:", err.message));

//Order Schema
const orderSchema = new mongoose.Schema({
  reference: String,
  email: String,
  amount: Number,
  items: Array,
  status: {
    type: String,
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Order = mongoose.model("Order", orderSchema);

//Verify payment and save order
app.post("/verify-payment", async (req, res) => {
  const { reference, email, amount, items } = req.body;

  try {
    console.log("Received payment verification request:", {
      reference,
      email,
      amount,
    });

    //Verify payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    console.log("Paystack response:", response.data);
    const paymentData = response.data.data;

    if (paymentData.status === "success") {
      console.log("Payment verified successfully, saving order...");

      //Save order to database
      const order = new Order({
        reference,
        email,
        amount,
        items,
        status: "confirmed",
      });

      await order.save();
      console.log("Order saved successfully:", order._id);

      res.json({
        success: true,
        message: "Payment verified and order saved",
        orderId: order._id,
      });
    } else {
      console.log("Payment verification failed. Status:", paymentData.status);
      res.json({
        success: false,
        message: "Payment verification failed",
      });
    }
  } catch (error) {
    console.error("Error in verify-payment:", error.message);
    console.error("Error details:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

//Get order by ID
app.get("/order/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
});

//Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
