// services/priceOptimizationService.js
const Product = require("../models/proudust");
const Order = require("../models/Order");
const Review = require("../models/Review");

class PriceOptimizationService {
    
    // ===== CALCULATE OPTIMAL PRICE FOR A PRODUCT =====
    async calculateOptimalPrice(productId) {
        try {
            const product = await Product.findById(productId);
            if (!product) {
                throw new Error("Product not found");
            }

            const allProducts = await Product.find({
                _id: { $ne: productId }
            });

            const reviews = await Review.find({ productId: productId });
            const totalReviews = reviews.length;
            const avgRating = totalReviews > 0 
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
                : 0;

            const orders = await Order.find({
                'products.productId': productId
            });

            // ===== FACTORS =====
            const demandScore = Math.min(orders.length / 10, 1);
            
            const competitors = allProducts.filter(p => 
                p.name.toLowerCase().includes(product.name.toLowerCase().split(' ')[0]) ||
                product.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
            );
            
            const avgCompetitorPrice = competitors.length > 0
                ? competitors.reduce((sum, p) => sum + p.price, 0) / competitors.length
                : product.price * 1.1;

            const reviewScore = avgRating / 5;

            const month = new Date().getMonth();
            const seasonalityFactors = {
                0: 1.0, 1: 0.9, 2: 1.0, 3: 1.1, 4: 1.2, 5: 1.3,
                6: 1.2, 7: 1.1, 8: 1.0, 9: 0.9, 10: 0.8, 11: 1.1
            };
            const seasonality = seasonalityFactors[month] || 1.0;

            const costPrice = product.price * 0.7;
            const desiredMargin = 1.3;

            // ===== CALCULATE OPTIMAL PRICE =====
            const weights = {
                competition: 0.30,
                demand: 0.25,
                reviews: 0.20,
                seasonality: 0.15,
                margin: 0.10
            };

            const competitionPrice = avgCompetitorPrice * 0.95;
            const demandPrice = product.price * (1 + (demandScore * 0.2));
            const reviewPrice = product.price * (1 + (reviewScore * 0.15));
            const seasonPrice = product.price * seasonality;
            const marginPrice = costPrice * desiredMargin;

            const optimalPrice = (
                (competitionPrice * weights.competition) +
                (demandPrice * weights.demand) +
                (reviewPrice * weights.reviews) +
                (seasonPrice * weights.seasonality) +
                (marginPrice * weights.margin)
            );

            const roundedPrice = Math.round(optimalPrice / 50) * 50;

            const priceDifference = roundedPrice - product.price;
            const percentageChange = ((priceDifference / product.price) * 100);

            let recommendation = "";
            let confidence = 0;

            if (Math.abs(percentageChange) < 2) {
                recommendation = "✅ Current price is optimal. No change needed.";
                confidence = 0.9;
            } else if (percentageChange < 0) {
                recommendation = `📉 Reduce price by ${Math.abs(percentageChange).toFixed(1)}% to PKR ${roundedPrice} for better sales.`;
                confidence = Math.min(demandScore + 0.3, 0.9);
            } else {
                recommendation = `📈 Increase price by ${percentageChange.toFixed(1)}% to PKR ${roundedPrice} for better profit.`;
                confidence = Math.min(reviewScore + 0.3, 0.9);
            }

            return {
                success: true,
                data: {
                    productId: product._id,
                    productName: product.name,
                    currentPrice: product.price,
                    optimalPrice: roundedPrice,
                    priceDifference: priceDifference,
                    percentageChange: parseFloat(percentageChange.toFixed(1)),
                    recommendation: recommendation,
                    confidence: parseFloat(confidence.toFixed(2)),
                    factors: {
                        demandScore: parseFloat(demandScore.toFixed(2)),
                        reviewScore: parseFloat(reviewScore.toFixed(2)),
                        avgCompetitorPrice: parseFloat(avgCompetitorPrice.toFixed(0)),
                        seasonality: parseFloat(seasonality.toFixed(2)),
                        totalReviews: totalReviews,
                        avgRating: parseFloat(avgRating.toFixed(1)),
                        totalOrders: orders.length
                    }
                }
            };

        } catch (error) {
            console.error("Price optimization error:", error);
            throw error;
        }
    }

    // ===== BULK PRICE OPTIMIZATION =====
    async updateProductPrices(shopId) {
        try {
            const products = await Product.find({ owner: shopId });
            
            if (products.length === 0) {
                return [];
            }

            const results = [];
            for (const product of products) {
                try {
                    const result = await this.calculateOptimalPrice(product._id);
                    if (result.success && result.data.percentageChange !== 0) {
                        await Product.findByIdAndUpdate(product._id, {
                            price: result.data.optimalPrice
                        });
                        results.push({
                            productId: product._id,
                            productName: product.name,
                            oldPrice: product.price,
                            newPrice: result.data.optimalPrice,
                            change: result.data.percentageChange,
                            status: "updated"
                        });
                    } else {
                        results.push({
                            productId: product._id,
                            productName: product.name,
                            oldPrice: product.price,
                            newPrice: product.price,
                            change: 0,
                            status: "unchanged"
                        });
                    }
                } catch (error) {
                    results.push({
                        productId: product._id,
                        productName: product.name,
                        error: error.message,
                        status: "failed"
                    });
                }
            }

            return results;

        } catch (error) {
            console.error("Bulk update error:", error);
            throw error;
        }
    }

    // ===== GET MARKET INSIGHTS =====
    async getMarketInsights(shopId) {
        try {
            const products = await Product.find({ owner: shopId });
            
            if (products.length === 0) {
                return {
                    success: false,
                    message: "No products found"
                };
            }

            const insights = await Promise.all(products.map(async (product) => {
                const result = await this.calculateOptimalPrice(product._id);
                return result.data;
            }));

            // 🔥 FIX: Ensure all values are numbers
            const totalCurrentValue = insights.reduce((sum, p) => {
                const price = typeof p.currentPrice === 'number' ? p.currentPrice : parseFloat(p.currentPrice) || 0;
                return sum + price;
            }, 0);

            const totalOptimalValue = insights.reduce((sum, p) => {
                const price = typeof p.optimalPrice === 'number' ? p.optimalPrice : parseFloat(p.optimalPrice) || 0;
                return sum + price;
            }, 0);

            const potentialRevenue = totalOptimalValue - totalCurrentValue;

            const averageConfidence = insights.reduce((sum, p) => {
                const conf = typeof p.confidence === 'number' ? p.confidence : parseFloat(p.confidence) || 0;
                return sum + conf;
            }, 0) / insights.length;

            return {
                success: true,
                insights: insights,
                summary: {
                    totalProducts: insights.length,
                    totalCurrentValue: totalCurrentValue,
                    totalOptimalValue: totalOptimalValue,
                    potentialRevenueIncrease: potentialRevenue,
                    averageConfidence: averageConfidence
                }
            };

        } catch (error) {
            console.error("Market insights error:", error);
            throw error;
        }
    }
}

module.exports = new PriceOptimizationService();


//doosre mie log kitne mie bej rahe hie 
//season o profit margin
//price optimiztion rating k zarye or demand kitna hie kitne khred rhe hien 