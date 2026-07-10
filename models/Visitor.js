const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    ipAddress: String,
    userAgent: String,
    visitedAt: {
        type: Date,
        default: Date.now
    },
    lastVisit: {
        type: Date,
        default: Date.now
    },
    visitCount: {
        type: Number,
        default: 1
    },
    pageVisited: String,
    referrer: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Visitor', visitorSchema);