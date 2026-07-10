// services/chatbotService.js - NAYA FILE
const Product = require("../models/proudust");
const Order = require("../models/Order");
const Singup = require("../models/singup");

class ChatbotService {
    constructor() {
        this.intents = {
            'greeting': ['hi', 'hello', 'hey', 'assalam o alaikum', 'salam'],
            'product_inquiry': ['product', 'price', 'cost', 'available', 'stock', 'size', 'color'],
            'order_status': ['order', 'status', 'delivery', 'shipment', 'tracking'],
            'return_policy': ['return', 'refund', 'exchange', 'cancel'],
            'payment': ['payment', 'pay', 'card', 'credit', 'debit', 'cod'],
            'vendor': ['vendor', 'seller', 'shop', 'store'],
            'help': ['help', 'support', 'assist', 'problem', 'issue'],
            'thanks': ['thanks', 'thank you', 'shukriya', 'jazakallah'],
            'goodbye': ['bye', 'goodbye', 'see you', 'khuda hafiz']
        };

        this.responses = {
            'greeting': [
                "Assalam o Alaikum! 👋 How can I help you today?",
                "Hello! Welcome to our marketplace. What can I assist you with?",
                "Hi there! I'm your AI shopping assistant. How may I help you?"
            ],
            'order_status': [
                "I can help you check your order status. Could you please provide your order ID?",
                "To check your order status, please share your order number or email address.",
                "Let me find your order details. Do you have the order number handy?"
            ],
            'return_policy': [
                "Our return policy: You can return products within 7 days of delivery. Items must be unused and in original packaging.",
                "Returns are accepted within 7 days. Free pickup is available for defective products.",
                "You can request a return from your orders page. Refunds are processed within 3-5 business days."
            ],
            'payment': [
                "We accept multiple payment methods: Credit/Debit cards, JazzCash, EasyPaisa, and Cash on Delivery.",
                "You can pay using your credit card, bank transfer, or cash on delivery. All payments are secure.",
                "We offer COD as well as online payment options. All major cards are accepted."
            ],
            'help': [
                "I'm here to help! You can ask me about products, orders, returns, or vendors.",
                "What would you like to know? I can assist with product search, order tracking, and more.",
                "Feel free to ask me anything about our marketplace. I'm here to make your shopping easier!"
            ],
            'thanks': [
                "You're welcome! 😊 Is there anything else I can help you with?",
                "My pleasure! Feel free to ask if you need anything else.",
                "Happy to help! Have a great day! 🌟"
            ],
            'goodbye': [
                "Goodbye! Visit us again soon! 👋",
                "Take care! Come back anytime for more great deals.",
                "Khuda Hafiz! Have a wonderful day! 🌙"
            ]
        };
    }

    async getResponse(userMessage, userId = null) {
        try {
            const msg = userMessage.toLowerCase().trim();

            // Check for specific product query
            if (msg.includes('product') || msg.includes('item')) {
                return await this.handleProductQuery(msg, userId);
            }

            // Check for specific order query
            if (msg.includes('order') && (msg.includes('status') || msg.includes('track'))) {
                return await this.handleOrderQuery(userId);
            }

            // Detect intent
            const intent = this.detectIntent(msg);
            
            // Get response based on intent
            let response = this.getResponseForIntent(intent);
            
            // Add extra context if needed
            if (intent === 'product_inquiry') {
                const productInfo = await this.getProductInfo(msg);
                if (productInfo) {
                    response += `\n\nI found a product matching your query: ${productInfo.name} - PKR ${productInfo.price}`;
                }
            }

            return {
                response: response,
                intent: intent,
                timestamp: new Date()
            };
        } catch (error) {
            console.error("Chatbot error:", error);
            return {
                response: "I apologize, I'm having trouble processing your request. Please try again or contact our support team.",
                intent: 'error'
            };
        }
    }

    detectIntent(message) {
        for (const [intent, keywords] of Object.entries(this.intents)) {
            if (keywords.some(keyword => message.includes(keyword))) {
                return intent;
            }
        }
        return 'help';
    }

    getResponseForIntent(intent) {
        const responses = this.responses[intent] || this.responses.help;
        return responses[Math.floor(Math.random() * responses.length)];
    }

    async handleProductQuery(query, userId) {
        // Extract product name from query
        const words = query.split(' ');
        const productKeywords = words.filter(word => 
            word.length > 3 && 
            !['product', 'about', 'price', 'cost', 'tell', 'show', 'find', 'search'].includes(word)
        );

        if (productKeywords.length > 0) {
            const searchTerm = productKeywords.join(' ');
            const products = await Product.find({
                name: { $regex: searchTerm, $options: 'i' }
            })
            .limit(3)
            .populate('owner', 'shopName');

            if (products.length > 0) {
                let response = `🔍 I found these products matching your search:\n\n`;
                products.forEach((p, i) => {
                    response += `${i + 1}. **${p.name}** - PKR ${p.price}\n`;
                    response += `   Sold by: ${p.owner.shopName}\n`;
                    response += `   Description: ${p.description.substring(0, 50)}...\n\n`;
                });
                return response;
            } else {
                return "Sorry, I couldn't find any products matching your search. Could you try different keywords?";
            }
        }
        
        return this.responses.product_inquiry[0];
    }

    async handleOrderQuery(userId) {
        if (!userId) {
            return "Please log in first to check your order status.";
        }

        const orders = await Order.find({ owner: userId })
            .sort({ createdAt: -1 })
            .limit(3)
            .populate('products.productId');

        if (orders.length === 0) {
            return "You don't have any orders yet. Start shopping to see your orders here!";
        }

        let response = "📦 Your recent orders:\n\n";
        orders.forEach((order, i) => {
            response += `${i + 1}. Order ID: ${order._id.toString().substring(0, 8)}...\n`;
            response += `   Status: ${order.status || 'Processing'}\n`;
            response += `   Items: ${order.products.length}\n`;
            response += `   Total: PKR ${order.products.reduce((sum, p) => sum + (p.price * p.quantity), 0)}\n\n`;
        });

        response += "Need more details? Just ask about a specific order!";
        return response;
    }

    async getProductInfo(query) {
        const words = query.split(' ');
        const productKeywords = words.filter(word => 
            word.length > 3 && 
            !['product', 'about', 'price', 'cost', 'tell', 'show', 'find', 'search'].includes(word)
        );

        if (productKeywords.length > 0) {
            const searchTerm = productKeywords.join(' ');
            const product = await Product.findOne({
                name: { $regex: searchTerm, $options: 'i' }
            }).populate('owner', 'shopName');

            return product;
        }
        return null;
    }
}

module.exports = new ChatbotService();