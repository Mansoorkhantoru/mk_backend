const mongoose = require("mongoose");

const AdSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "singup", // Your User model name
      required: true,
      index: true, // For faster queries when fetching a user's ads
    },
    adhero: {
      type: String, // Cloudinary URL or file path
      required: true,
    },
    adpublicId: {
      type: String, // Cloudinary public ID (to delete the image later if needed)
    },
    productUrl: {
      type: String,
      required: true,
    },
    shopUrl: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // This gives createdAt and updatedAt
  }
);

// 🟢 THE MAGIC LINE: Delete this document 24 hours (86400 seconds) after creation
AdSchema.index({ createdAt: 1 }, { expireAfterSeconds: 40000 });

module.exports = mongoose.model("Ad", AdSchema);