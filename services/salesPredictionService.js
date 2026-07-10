// services/salesPredictionService.js
const Order = require("../models/Order");
const Product = require("../models/proudust");

class SalesPredictionService {
    // Predict sales for next N days
    async predictSales(vendorId, days = 30) {
        try {
            // Get historical sales data
            const historicalData = await this.getHistoricalSales(vendorId, 90);
            
            if (historicalData.length < 7) {
                return {
                    success: false,
                    message: "Not enough data for prediction"
                };
            }

            // Simple moving average for prediction
            const predictions = this.calculatePredictions(historicalData, days);
            
            // Calculate trends
            const trends = this.analyzeTrends(predictions);
            
            // Get top selling products
            const topProducts = await this.getTopSellingProducts(vendorId);

            return {
                success: true,
                predictions: predictions,
                trends: trends,
                topProducts: topProducts,
                summary: {
                    totalPredictedRevenue: predictions.reduce((sum, p) => sum + p.predictedSales, 0),
                    averageDailySales: predictions.reduce((sum, p) => sum + p.predictedSales, 0) / predictions.length,
                    bestDay: predictions.reduce((max, p) => p.predictedSales > max.predictedSales ? p : max, predictions[0]),
                    worstDay: predictions.reduce((min, p) => p.predictedSales < min.predictedSales ? p : min, predictions[0])
                }
            };
        } catch (error) {
            console.error("Sales prediction error:", error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    async getHistoricalSales(vendorId, days = 90) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const orders = await Order.find({
            owner: vendorId,
            createdAt: { $gte: startDate }
        });

        // Group by date
        const salesByDate = {};
        orders.forEach(order => {
            const date = order.createdAt.toISOString().split('T')[0];
            if (!salesByDate[date]) {
                salesByDate[date] = 0;
            }
            salesByDate[date] += order.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        });

        // Fill missing dates with 0
        const dateArray = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            dateArray.push({
                date: dateStr,
                sales: salesByDate[dateStr] || 0
            });
        }

        return dateArray;
    }

    calculatePredictions(historicalData, days = 30) {
        // Simple moving average (7-day)
        const windowSize = 7;
        const predictions = [];
        const lastDate = new Date(historicalData[historicalData.length - 1].date);
        
        // Calculate moving average from last window
        const lastWindow = historicalData.slice(-windowSize);
        const avgSales = lastWindow.reduce((sum, d) => sum + d.sales, 0) / windowSize;

        // Calculate trend
        const olderWindow = historicalData.slice(-windowSize * 2, -windowSize);
        const olderAvg = olderWindow.reduce((sum, d) => sum + d.sales, 0) / windowSize;
        const trend = (avgSales - olderAvg) / olderAvg;

        for (let i = 1; i <= days; i++) {
            const date = new Date(lastDate);
            date.setDate(date.getDate() + i);
            
            // Adjust for day of week (weekends might have higher sales)
            const dayOfWeek = date.getDay();
            const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.3 : 1;
            
            // Predict with trend and seasonality
            let predictedSales = avgSales * (1 + trend * (i / 30)) * weekendFactor;
            
            // Add some random variation for realism
            predictedSales = predictedSales * (0.9 + Math.random() * 0.2);
            
            predictions.push({
                date: date.toISOString().split('T')[0],
                predictedSales: Math.round(predictedSales * 100) / 100,
                confidence: 0.7 + (1 - (i / days)) * 0.3 // Higher confidence for near future
            });
        }

        return predictions;
    }

    analyzeTrends(predictions) {
        const firstWeek = predictions.slice(0, 7);
        const lastWeek = predictions.slice(-7);
        
        const firstAvg = firstWeek.reduce((sum, p) => sum + p.predictedSales, 0) / firstWeek.length;
        const lastAvg = lastWeek.reduce((sum, p) => sum + p.predictedSales, 0) / lastWeek.length;
        
        const growth = ((lastAvg - firstAvg) / firstAvg) * 100;

        return {
            growthRate: growth,
            trend: growth > 5 ? 'upward' : growth < -5 ? 'downward' : 'stable',
            bestPerformingDay: predictions.reduce((max, p) => p.predictedSales > max.predictedSales ? p : max, predictions[0]),
            worstPerformingDay: predictions.reduce((min, p) => p.predictedSales < min.predictedSales ? p : min, predictions[0])
        };
    }

    async getTopSellingProducts(vendorId, limit = 5) {
        const orders = await Order.find({ owner: vendorId })
            .populate('products.productId');

        const productSales = {};
        orders.forEach(order => {
            order.products.forEach(p => {
                const id = p.productId._id.toString();
                if (!productSales[id]) {
                    productSales[id] = {
                        product: p.productId,
                        quantity: 0,
                        revenue: 0
                    };
                }
                productSales[id].quantity += p.quantity;
                productSales[id].revenue += p.price * p.quantity;
            });
        });

        return Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit);
    }
}

module.exports = new SalesPredictionService();



//Ye Sales Prediction Service hai — ye batata hai ke agle 30 dinon mein aapki dukaan ki bikri (sales) kitni hogi