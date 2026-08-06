const mongoose = require("mongoose")

const UsersingupSchema = mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true, // <-- Yeh ensure karega ke email unique ho
        lowercase: true, // <-- Email ko lowercase mein store karega
        trim: true // <-- Extra spaces remove karega
    },
    password: {
        type: String,
        required: true 
    },
    shopName: {
        type: String,
        default: "",
        unique: true, 
        sparse: true, 
        trim: true
    },
    image: {
        type: String
    },
    heroImages: {
        type: String
    },
    heroPublicId: {
        type: String
    },
    description: {
        type: String 
    },
    adress: {
        type: String 
    },
    phone: {
        type: Number 
    },
    publicId: {
        type: String
    },
    resetOTP: {
        type: String,
        default: null
    },
    resetOTPExpiry: {
        type: Date,
        default: null
    },
    resetOTPAttempts: {
        type: Number,
        default: 0
    },
    resetOTPLocked: {
        type: Boolean,
        default: false
    },
    resetOTPLockExpiry: {
        type: Date,
        default: null
    },
    // adhero:{
    //     type:String,
        
    // },
    // adpublicId:{
    //     type:String
    // },
    // productUrl:{
    //     type:String,
    //     required:true
    // },
    // shopUrl:{
    //     type:String,
    //     required:true
    // }
}, { timestamps: true })

// Yeh ensure karega ke agar MongoDB mein already duplicate data hai to index build ho sake
//UsersingupSchema.index({ email: 1 }, { unique: true })
//UsersingupSchema.index({ shopName: 1 }, { unique: true, sparse: true })

module.exports = mongoose.model("singup", UsersingupSchema)