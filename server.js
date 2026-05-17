const express = require("express");
// const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB connection and order persistence were removed to restore the previous backend structure.
// The admin dashboard and order storage endpoints are disabled, but the file structure remains.

//Verify payment
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
      console.log("Payment verified successfully");

      res.json({
        success: true,
        message: "Payment verified",
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

// Admin dashboard and order management routes were removed to restore the original backend structure.
// The files remain for structure, but those endpoints are no longer active.

//Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`📍 API available at http://localhost:${PORT}`);
  if (!process.env.MONGODB_URI) {
    console.log(`\n⚠️  WARNING: MONGODB_URI not found in .env`);
    console.log(`Please add it: MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname`);
  }
  console.log("");
});
