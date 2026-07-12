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
    },slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    sparse: true
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
UsersingupSchema.pre('save', async function(next) {
    // Sirf tab slug generate karein jab shopName change ho ya naya document ho
    if (this.isModified('shopName') && this.shopName) {
        // Basic slug generate karein
        let baseSlug = this.shopName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        
        // Check if slug already exists
        const existingShop = await mongoose.model('singup').findOne({ slug: baseSlug });
        
        if (existingShop && existingShop._id.toString() !== this._id.toString()) {
            // Agar slug exist karta hai toh unique banayein
            let counter = 1;
            let newSlug = `${baseSlug}-${counter}`;
            while (await mongoose.model('singup').findOne({ slug: newSlug })) {
                counter++;
                newSlug = `${baseSlug}-${counter}`;
            }
            this.slug = newSlug;
        } else {
            this.slug = baseSlug;
        }
    }
    next();
});
module.exports = mongoose.model("singup", UsersingupSchema)