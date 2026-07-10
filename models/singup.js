const mongoose = require("mongoose")

const UsersingupSchema = mongoose.Schema({
    email: {
        type: String,
        required: true 
    },
    password: {
        type: String,
        required: true 
    },
    shopName: {
        type: String,
         default: "", 
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
    description:{
        type:String 
    },
    adress:{
        type:String 
    },
    phone:{
        type:Number 
    },
    publicId: {
        type: String
    }
})

module.exports = mongoose.model("singup", UsersingupSchema)