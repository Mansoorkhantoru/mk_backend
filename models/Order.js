const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    products: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product"  // Make sure this matches your Product model name
        },
        quantity: {
            type: Number,
            default: 1
        },
        price: {
            type: Number,
            default: 0
        }
    }],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "singup"  // Change this to match your model name (lowercase 'singup')
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'preparing', 'on_the_way', 'delivered', 'cancelled'],
        default: 'pending'
    },
    statusHistory: [{
        status: String,
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "singup"  // Change this to match your model name
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        note: String
    }],
    customerName: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    shippingAddress: {
        type: String,
        required: true
    },
    city: String,
    zipCode: String,
    orderNotes: String,
    totalAmount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Make sure the model name matches what you use elsewhere
module.exports = mongoose.model("Order", orderSchema);