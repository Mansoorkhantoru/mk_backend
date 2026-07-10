const mongoose = require('mongoose');

const UserBehaviorSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Singup',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    action: {
        type: String,
        enum: ['view', 'purchase', 'add_to_cart', 'wishlist'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    sessionId: {
        type: String,
        default: null
    }
});

// Index for faster queries
UserBehaviorSchema.index({ userId: 1, productId: 1 });
UserBehaviorSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('UserBehavior', UserBehaviorSchema);