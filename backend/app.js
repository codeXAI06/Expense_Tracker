const express = require("express");

const app = express();

// Middleware
app.use(express.json());

// Test Route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Expense Tracker API is running 🚀"
    });
});

module.exports = app;