const mongoose = require("mongoose")

const productSchema = new mongoose.Schema({
    name:String,
    price:String,
    description:String,
    image:String,

    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"singup"
    },
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review"
    }],
    averageRating: {
        type: Number,
        default: 0
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    
    //for top product
    rating: {
    type: Number,
    default: 0
},
reviewCount: {
    type: Number,
    default: 0
},
soldCount: {
    type: Number,
    default: 0
}

}, {
    timestamps: true
})

module.exports = mongoose.model("Product",productSchema)