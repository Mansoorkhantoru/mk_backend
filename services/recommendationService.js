// services/recommendationService.js - NAYA FILE
const Product = require("../models/proudust");
const Order = require("../models/Order");
const axios = require('axios');

class RecommendationService {
    // Content-based recommendations (based on product features)
    // ye dekhta hie k tum nie kya order kya hie un ka jo rate hie o kesi or cheez ka same aa raha hie thu recommend krta hie
    // ya kesi or nie os product k sath or kuch order kya hie tu tumhe b recomnd krta hie 
    async getContentBasedRecommendations(productId, limit = 10) {
        try {
            const product = await Product.findById(productId);
            if (!product) return [];

            // Find similar products by category, price range, etc.
            const similarProducts = await Product.find({
                _id: { $ne: productId },
                // Price within ±30%
                price: { 
                    $gte: product.price * 0.7, 
                    $lte: product.price * 1.3 
                },
                // You can add more criteria like category
            })
            .limit(limit)
            .populate('owner', 'shopName');

            return similarProducts;
        } catch (error) {
            console.error("Recommendation error:", error);
            return [];
        }
    }

    // Collaborative filtering (based on user behavior)
    async getCollaborativeRecommendations(userId, limit = 10) {
        try {
            // Get user's order history
            const userOrders = await Order.find({ owner: userId })
                .populate('products.productId');
            
            // Get product IDs user has bought
            const purchasedProductIds = userOrders.flatMap(order => 
                order.products.map(p => p.productId._id.toString())
            );

            // Find other users who bought similar products
            const otherOrders = await Order.find({
                'products.productId': { $in: purchasedProductIds },
                owner: { $ne: userId }
            }).populate('products.productId');

            // Get product IDs others bought
            const otherProductIds = otherOrders.flatMap(order =>
                order.products.map(p => p.productId._id.toString())
            );

            // Find recommendations (exclude already purchased)
            const recommendations = await Product.find({
                _id: { 
                    $in: otherProductIds,
                    $nin: purchasedProductIds 
                }
            })
            .limit(limit)
            .populate('owner', 'shopName');

            return recommendations;
        } catch (error) {
            console.error("Collaborative filtering error:", error);
            return [];
        }
    }

    // Hybrid recommendation
    async getHybridRecommendations(userId, productId = null, limit = 10) {
        try {
            let recommendations = [];
            
            if (productId) {
                // Content-based from current product
                const contentBased = await this.getContentBasedRecommendations(productId, limit);
                recommendations = [...contentBased];
            }

            if (userId) {
                // Collaborative from user history
                const collaborative = await this.getCollaborativeRecommendations(userId, limit);
                
                // Merge and deduplicate
                const merged = [...recommendations, ...collaborative];
                const unique = merged.filter((v, i, a) => 
                    a.findIndex(t => t._id.toString() === v._id.toString()) === i
                );
                recommendations = unique.slice(0, limit);
            }

            return recommendations;
        } catch (error) {
            console.error("Hybrid recommendation error:", error);
            return [];
        }
    }
}

module.exports = new RecommendationService();