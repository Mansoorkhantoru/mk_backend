const mongoose = require("mongoose")

const productSchema = new mongoose.Schema({
    name:String,
    price:String,
    description:String,
    image:String,
     slug: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true,
        sparse: true // Allows multiple null values
    },
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
    }

}, {
    timestamps: true
})

productSchema.pre('save', async function(next) {
    // Only generate slug if name exists and is modified or new
    if (this.isModified('name') && this.name && this.name.trim() !== '') {
        // Generate base slug from product name
        let baseSlug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        
        // If baseSlug is empty, use a default
        if (!baseSlug) {
            baseSlug = 'product-' + Date.now();
        }
        
        // Check if slug already exists (excluding current document)
        const existingProduct = await mongoose.model('Product').findOne({ 
            slug: baseSlug,
            _id: { $ne: this._id }
        });
        
        if (existingProduct) {
            // Make slug unique by adding a number
            let counter = 1;
            let newSlug = `${baseSlug}-${counter}`;
            while (await mongoose.model('Product').findOne({ 
                slug: newSlug,
                _id: { $ne: this._id }
            })) {
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

// ✅ Generate slug for existing products (one-time migration)
productSchema.statics.generateSlugsForExisting = async function() {
    const products = await this.find({ slug: { $exists: false } });
    let count = 0;
    
    for (const product of products) {
        if (product.name) {
            let baseSlug = product.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            
            if (!baseSlug) {
                baseSlug = 'product-' + product._id.toString().substring(0, 8);
            }
            
            // Check for duplicates
            let finalSlug = baseSlug;
            let counter = 1;
            while (await this.findOne({ slug: finalSlug, _id: { $ne: product._id } })) {
                finalSlug = `${baseSlug}-${counter}`;
                counter++;
            }
            
            product.slug = finalSlug;
            await product.save();
            count++;
        }
    }
    
    return count;
};
module.exports = mongoose.model("Product",productSchema)