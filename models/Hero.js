const mongoose = require('mongoose')

const heroSchema = mongoose.Schema({
    
    heroImages:{
        type:String
    },
    owner:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"singup"
        }
})

module.exports = mongoose.model("HeroSection", heroSchema)