const express = require("express")
const app = express()
const http = require("http");
const Singup = require("./models/singup")
const cors = require("cors")
app.use(cors())
const dotenv = require("dotenv")
dotenv.config()
const Connect = require("./config/conSingup")
Connect()
app.use(express.json())
const bcrypt = require("bcrypt")
const auth = require("./middleware/auth")
const jwt = require("jsonwebtoken")
const Product = require("./models/proudust")
const { upload, cloudinary } = require("./config/Cloudinary")
const { Server } = require("socket.io");
const Review = require("./models/Review")
const Order = require("./models/Order")
const transporter = require("./config/mail")
const Visitor = require('./models/Visitor');
const UserBehavior = require('./models/UserBehavior');
// ========== IMPORT AI SERVICES ==========
const recommendationService = require("./services/recommendationService");
const priceOptimizationService = require("./services/priceOptimizationService");
const salesPredictionService = require("./services/salesPredictionService");
const chatbotService = require("./services/chatbotService");

// ========== IMPORT EMAIL SERVICES ==========
const { sendOrderConfirmationEmail, sendShopOwnerOrderNotification, sendOrderStatusUpdateEmail } = require('./config/emailService');

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    
    // Join room for specific shop
    socket.on('join-shop-room', (shopId) => {
        socket.join(`shop-${shopId}`);
        console.log(`User joined shop-${shopId} room`);
    });
    
    // Join room for specific order
    socket.on('join-order-room', (orderId) => {
        socket.join(`order-${orderId}`);
        console.log(`User joined order-${orderId} room`);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

// ========== OTP STORE ==========
const otpStore = {}

// ========== AUTH ROUTES ==========
app.post("/singup", upload.single('image'), async (req, res) => {
    try {
        const { email, password, shopName } = req.body;
          const existingEmail = await Singup.findOne({ email })
        if (existingEmail) {
            return res.status(400).json({ 
                success: false, 
                message: "Ye email already registered hai! Koi aur email use karein." 
            })
        }

      

        const hashPassword = await bcrypt.hash(password, 10)
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload image"
            })
        }
        const user = await Singup.create({
            email,
            password: hashPassword,
            shopName,
            image: req.file.path,
            publicId: req.file.filename
        })
        res.json({
            success: true,
            message: "User Shop created Successfully",
            user
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await Singup.findOne({ email })
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
        const match = await bcrypt.compare(password, user.password)
        if (!match) {
            return res.status(401).json({
                success: false,
                message: "Wrong password"
            })
        }
        const token = jwt.sign({ id: user._id }, "mksecretkey")
        res.json({
            success: true,
            token,
            user
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
})

// ========== OTP ROUTES ==========
app.post("/send-otp", async (req, res) => {
    try {
        const { email } = req.body
          const existingUser = await Singup.findOne({ email })
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "❌ This email is already registered! Please login instead."
            })
        }
        const otp = Math.floor(100000 + Math.random() * 900000)
        otpStore[email] = otp
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP is ${otp}`
        })
        res.json({
            success: true,
            message: "OTP sent"
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
})

app.post("/verify-otp", async (req, res) => {
    try {
      const { email, otp, password, cpassword } = req.body  // ✅ cpassword add karein
        
        // ✅ Check if passwords match
        if (password !== cpassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match!"
            });
        }
        
        // ✅ Check password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }
        
        // ✅ Check if OTP exists for this email
        if (!otpStore[email]) {
            return res.status(400).json({
                success: false,
                message: "Please request OTP first"
            });
        }
        
       if (otpStore[email] != otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            })
        }
         const existingUser = await Singup.findOne({ email })
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already registered! Please login."
            });
        }
           const hashPassword = await bcrypt.hash(password, 10)
      
        const user = await Singup.create({
            email,
            password: hashPassword,
            shopName: "",
            image: "",
            publicId: ""
        })
        delete otpStore[email]
        
        const token = jwt.sign({ id: user._id }, "mksecretkey")
        res.json({
            success: true,
            message: "User created",
            token,
            user
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
})

// ========== CREATE SHOP ==========
app.post("/create-shop", auth, upload.single('image'), async (req, res) => {
    try {
        const { shopName, description, address, phone } = req.body;
          if (shopName) {
            const existingShop = await Singup.findOne({ shopName })
            if (existingShop) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Ye shop name already use ho raha hai! Koi aur name rakhein." 
                })
            }
        }
        if (!shopName || shopName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Shop name is required"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Shop image is required"
            });
        }

        const user = await Singup.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.shopName = shopName.trim();
        user.image = req.file.path;
        user.publicId = req.file.filename;
        user.description = description || '';
        user.address = address || '';
        user.phone = phone || '';
        
        await user.save();

        res.json({
            success: true,
            message: "Shop created successfully",
            user: {
                id: user._id,
                email: user.email,
                shopName: user.shopName,
                image: user.image,
                description: user.description,
                address: user.address,
                phone: user.phone
            }
        });

    } catch (error) {
        console.error("Create shop error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== SHOP ROUTES ==========
app.get("/shops", async (req, res) => {
    try {
        const shops = await Singup.find()
        res.json({
            success: true,
            shops
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

// Public shop route (no auth required)
app.get("/public-shop/:id", async (req, res) => {
    try {
        const shop = await Singup.findById(req.params.id)
            .select('shopName email image description address phone heroImages')
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found"
            })
        }
        res.json({
            success: true,
            shop
        })
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        })
    }
})

// Protected shop route (requires auth)
app.get("/shops/:id", auth, async (req, res) => {
    try {
        const shop = await Singup.findById(req.params.id)
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found"
            })
        }
        res.json({ success: true, shop })
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        })
    }
})

// ========== PRODUCT ROUTES ==========
app.post("/addproduct", auth, upload.single('image'), async (req, res) => {
    try {
        const product = new Product({
            name: req.body.name,
            price: req.body.price,
            description: req.body.description,
            image: req.file.path,
            publicId: req.file.filename,
            owner: req.userId
        })
        await product.save()
        res.json({
            success: true,
            message: "Uploaded successfully",
            product
        })
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        })
    }
})

app.get("/shop-products/:id", async (req, res) => {
    try {
        const products = await Product.find({
            owner: req.params.id
        })
        res.json({
            success: true,
            products
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
})

app.get("/all-products", async (req, res) => {
    try {
        const products = await Product.find().populate('owner', 'shopName')
        res.json({
            success: true,
            products
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
})

app.get("/my-products", auth, async (req, res) => {
    try {
        const products = await Product.find({
            owner: req.userId
        })
        res.json({
            success: true,
            products
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
})
// ========== DELETE SHOP (Admin Only - No Auth Required) ==========
// Import the notification functions
const { 
    sendShopDeletionNotification,
    sendProductDeletionNotification
} = require('./config/emailService');

// ========== DELETE SHOP (Simple - Direct Delete with Notification) ==========
app.delete("/shops/:id", async (req, res) => {
    try {
        const shopId = req.params.id;
        const { reason } = req.body;
        
        // Find the shop
        const shop = await Singup.findById(shopId);
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found"
            });
        }

        // Get product count for email
        const productCount = await Product.countDocuments({ owner: shopId });
        
        // Store shop data for email before deletion
        const shopData = {
            ...shop.toObject(),
            productCount: productCount
        };

        // Delete all products
        await Product.deleteMany({ owner: shopId });
        
        // Delete all reviews
        await Review.deleteMany({ shopId: shopId });

        // Delete the shop
        await Singup.findByIdAndDelete(shopId);

        // Send deletion notification email
        await sendShopDeletionNotification(
            shopData, 
            reason || 'Admin request', 
            process.env.EMAIL || 'admin@shop.com'
        );

        res.json({
            success: true,
            message: "Shop deleted successfully. Notification email sent to shop owner.",
            shop: shopData
        });

    } catch (error) {
        console.error("Delete shop error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== DELETE PRODUCT (Simple - Direct Delete with Notification) ==========
app.delete("/admin/products/:id", async (req, res) => {
    try {
        const productId = req.params.id;
        const { reason } = req.body;
        
        // Find the product with owner details
        const product = await Product.findById(productId).populate('owner', 'email shopName');
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Store product data for email
        const productData = { ...product.toObject() };
        
        // Delete reviews
        await Review.deleteMany({ productId: productId });
        
        // Delete product
        await Product.findByIdAndDelete(productId);

        // Send deletion notification email
        await sendProductDeletionNotification(
            productData, 
            reason || 'Admin request', 
            process.env.EMAIL || 'admin@shop.com'
        );

        res.json({
            success: true,
            message: "Product deleted successfully. Notification email sent to shop owner.",
            product: productData
        });

    } catch (error) {
        console.error("Delete product error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
app.delete("/shop-products/:id", async (req, res) => {
    try {
        const deleteProduct = await Product.findByIdAndDelete(req.params.id)
        if (!deleteProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            })
        }
        res.json({
            success: true,
            message: "Product deleted successfully",
            deleteProduct
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
})
// ========== DELETE PRODUCT (Admin - No Auth Required) ==========


// ========== GET PRODUCT WITH REVIEWS ==========
app.get("/admin/products/:id/details", async (req, res) => {
    try {
        const productId = req.params.id;
        
        // Get product with shop owner details
        const product = await Product.findById(productId)
            .populate('owner', 'shopName email image');
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Get all reviews for this product
        const reviews = await Review.find({ productId: productId })
            .sort({ createdAt: -1 });

        // Calculate statistics
        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0 
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
            : 0;

        // Rating distribution
        const ratingDistribution = {
            5: reviews.filter(r => r.rating === 5).length,
            4: reviews.filter(r => r.rating === 4).length,
            3: reviews.filter(r => r.rating === 3).length,
            2: reviews.filter(r => r.rating === 2).length,
            1: reviews.filter(r => r.rating === 1).length
        };

        res.json({
            success: true,
            product: product,
            reviews: reviews,
            stats: {
                averageRating: averageRating || 0,
                totalReviews: totalReviews || 0,
                ratingDistribution: ratingDistribution
            }
        });

    } catch (error) {
        console.error("Product details error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// ========== UPDATE PRODUCT ROUTE ==========
app.put("/edit-product/:id", auth, upload.single('image'), async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, price, description } = req.body;
        
        // Find the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }
        
        // Check if user owns this product
        if (product.owner.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to edit this product"
            });
        }
        
        // Update fields
        if (name) product.name = name;
        if (price) product.price = price;
        if (description) product.description = description;
        
        // Handle image upload if provided
        if (req.file) {
            // Delete old image from cloudinary
            if (product.publicId) {
                await cloudinary.uploader.destroy(product.publicId);
            }
            product.image = req.file.path;
            product.publicId = req.file.filename;
        }
        
        await product.save();
        
        res.json({
            success: true,
            message: "Product updated successfully",
            product
        });
        
    } catch (error) {
        console.error("Edit product error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== GET SINGLE PRODUCT ROUTE ==========
app.get("/product/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('owner', 'shopName email image');
            
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }
        
        res.json({
            success: true,
            product
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// ========== PRODUCT DETAILS ROUTE ==========
app.get("/products/:productId/details", async (req, res) => {
    try {
        const { productId } = req.params;
        
        const product = await Product.findById(productId)
            .populate('owner', 'shopName email image');
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const reviews = await Review.find({ productId: productId });
        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0 
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
            : 0;

        res.json({
            success: true,
            product: product,
            stats: {
                averageRating: averageRating || 0,
                totalReviews: totalReviews || 0
            }
        });

    } catch (error) {
        console.error("Product details error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== ORDER ROUTES ==========
app.post("/order", async (req, res) => {
    try {
        const { products, shopId, customerDetails } = req.body;
        
        if (!products || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No products in order"
            });
        }

        if (!customerDetails || !customerDetails.email || !customerDetails.phone || !customerDetails.address) {
            return res.status(400).json({
                success: false,
                message: "Customer details are required"
            });
        }

        const firstProduct = await Product.findById(products[0].productId);
        if (!firstProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Calculate total amount
        let totalAmount = 0;
        for (const item of products) {
            const product = await Product.findById(item.productId);
            if (product) {
                totalAmount += product.price * (item.quantity || 1);
            }
        }

        const order = new Order({
            products: products.map(p => ({
                productId: p.productId,
                quantity: p.quantity || 1,
                price: p.price || 0
            })),
            owner: shopId || firstProduct.owner,
            customerName: customerDetails.name || 'Guest',
            customerEmail: customerDetails.email,
            customerPhone: customerDetails.phone,
            shippingAddress: customerDetails.address,
            city: customerDetails.city || '',
            zipCode: customerDetails.zipCode || '',
            orderNotes: customerDetails.notes || '',
            totalAmount: totalAmount,
            statusHistory: [{
                status: 'pending',
                note: 'Order placed'
            }]
        });

        await order.save();

        // Populate product details for email
        const populatedOrder = await Order.findById(order._id)
            .populate('products.productId')
            .populate('owner', 'email shopName');

        // Send email notifications
        await sendOrderConfirmationEmail(populatedOrder);
        await sendShopOwnerOrderNotification(populatedOrder);

        // Emit socket event for real-time notification
        const shopOwnerId = shopId || firstProduct.owner;
        io.emit('new-order', {
            orderId: order._id,
            shopId: shopOwnerId,
            customerEmail: customerDetails.email,
            customerName: customerDetails.name,
            totalAmount: totalAmount,
            message: '🆕 New order placed!',
            timestamp: new Date()
        });

        // Emit to specific shop room
        io.to(`shop-${shopOwnerId}`).emit('shop-new-order', {
            orderId: order._id,
            customerName: customerDetails.name,
            totalAmount: totalAmount,
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: "Order placed successfully! Check your email for confirmation.",
            order: populatedOrder
        });

    } catch (error) {
        console.error("Order error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ===== GET USER ORDERS =====
app.get("/myOrders", auth, async (req, res) => {
    try {
        const orders = await Order.find({
            owner: req.userId
        }).populate("products.productId")
        res.json({
            success: true,
            orders
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
})

// ===== GET SHOP ORDERS (Shop Owner) =====
app.get("/shop-orders", auth, async (req, res) => {
    try {
        const orders = await Order.find({
            owner: req.userId
        })
        .populate('products.productId')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ===== GET SPECIFIC ORDER =====
app.get("/orders/:orderId", async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('products.productId')
            .populate('owner', 'email shopName phone address');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ===== DELETE ORDER =====
app.delete("/myOrders/:id", async (req, res) => {
    try {
        const deleteOrder = await Order.findByIdAndDelete(req.params.id)
        if (!deleteOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            })
        }
        res.json({
            success: true,
            message: "Order deleted",
            deleteOrder
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
})

// ===== UPDATE ORDER STATUS (Shop Owner) =====
app.put("/myOrders/:id/status", auth, async (req, res) => {
    try {
        const { status, note } = req.body;
        const allowedStatuses = ['pending', 'accepted', 'preparing', 'on_the_way', 'delivered', 'cancelled'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${allowedStatuses.join(", ")}`
            });
        }

        const order = await Order.findById(req.params.id)
            .populate('products.productId')
            .populate('owner', 'email shopName');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Only the shop that owns this order can update it
        if (order.owner._id.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to update this order"
            });
        }

        const oldStatus = order.status;
        order.status = status;
        order.statusHistory.push({
            status,
            updatedBy: req.userId,
            note: note || undefined
        });

        await order.save();

        // Send email notification about status change
        await sendOrderStatusUpdateEmail(order, oldStatus, status);

        // Emit socket event for real-time notification
        io.emit('order-status-update', {
            orderId: order._id,
            customerEmail: order.customerEmail,
            status: status,
            oldStatus: oldStatus,
            message: `📦 Your order status has been updated to ${status}`,
            timestamp: new Date()
        });

        // Emit to specific order room
        io.to(`order-${order._id}`).emit('order-updated', {
            orderId: order._id,
            status: status,
            note: note || '',
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: "Order status updated",
            order
        });
    } catch (error) {
        console.error("Status update error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== PROFILE ROUTE ==========
app.get("/profile", auth, async (req, res) => {
    try {
        const user = await Singup.findById(req.userId).select("-password")
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
        res.json({
            success: true,
            user
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
})

// ========== HERO SECTION ROUTES ==========
app.post("/heroSection/:shopId", auth, upload.single('image'), async (req, res) => {
    try {
        const { shopId } = req.params;
        if (req.userId !== shopId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized"
            });
        }
        const shop = await Singup.findById(shopId);
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found"
            });
        }
        shop.heroImages = req.file.path;
        shop.heroPublicId = req.file.filename;
        await shop.save();
        res.json({
            success: true,
            message: "Hero image uploaded",
            hero: shop.heroImages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("/hero/:shopId", async (req, res) => {
    try {
        const { shopId } = req.params;
        const shop = await Singup.findById(shopId).select('heroImages shopName email');
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found"
            });
        }
        res.json({
            success: true,
            hero: shop
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("/my-hero", auth, async (req, res) => {
    try {
        const shop = await Singup.findById(req.userId).select('heroImages shopName email');
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found"
            });
        }
        res.json({
            success: true,
            hero: shop
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.delete("/heroSection/:shopId", auth, async (req, res) => {
    try {
        const { shopId } = req.params;
        if (req.userId !== shopId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized"
            });
        }
        const shop = await Singup.findById(shopId);
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: "Shop not found"
            });
        }
        shop.heroImages = null;
        shop.heroPublicId = null;
        await shop.save();
        res.json({
            success: true,
            message: "Hero image removed"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== REVIEW ROUTES ==========
app.post("/products/:productId/reviews", auth, async (req, res) => {
    try {
        const { productId } = req.params;
        const { rating, comment } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Comment is required"
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const existingReview = await Review.findOne({
            productId: productId,
            userId: req.userId
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: "You already reviewed this product"
            });
        }

        const user = await Singup.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const review = new Review({
            productId: productId,
            userId: req.userId,
            userEmail: user.email,
            userName: user.shopName || user.email,
            rating: rating,
            comment: comment.trim()
        });

        await review.save();

        product.reviews.push(review._id);
        const allReviews = await Review.find({ productId: productId });
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        product.averageRating = totalRating / allReviews.length;
        product.totalReviews = allReviews.length;
        await product.save();

        res.status(201).json({
            success: true,
            message: "Review added",
            review: review,
            averageRating: product.averageRating,
            totalReviews: product.totalReviews
        });

    } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== REVIEW ROUTES (COMPLETE) ==========


// ========== GET ALL REVIEWS FOR A PRODUCT ==========
app.get("/products/:productId/reviews", async (req, res) => {
    try {
        const { productId } = req.params;
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }
        
        const reviews = await Review.find({ productId: productId })
            .sort({ createdAt: -1 });
        
        // Calculate average rating
        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0 
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
            : 0;
        
        res.json({
            success: true,
            reviews: reviews,
            averageRating: averageRating || 0,
            totalReviews: totalReviews || 0
        });
        
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== GET USER'S REVIEW FOR A PRODUCT ==========
app.get("/products/:productId/user-review", auth, async (req, res) => {
    try {
        const { productId } = req.params;
        
        const review = await Review.findOne({
            productId: productId,
            userId: req.userId
        });
        
        res.json({
            success: true,
            hasReviewed: !!review,
            review: review || null
        });
        
    } catch (error) {
        console.error("Error checking user review:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== UPDATE REVIEW ==========
app.put("/reviews/:reviewId", auth, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, comment } = req.body;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }
        
        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Comment is required"
            });
        }
        
        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found"
            });
        }
        
        // Check if user owns this review
        if (review.userId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to update this review"
            });
        }
        
        review.rating = rating;
        review.comment = comment.trim();
        review.updatedAt = Date.now();
        await review.save();
        
        // Update product's average rating
        await updateProductRating(review.productId);
        
        res.json({
            success: true,
            message: "Review updated successfully",
            review: review
        });
        
    } catch (error) {
        console.error("Error updating review:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== DELETE REVIEW ==========
app.delete("/reviews/:reviewId", auth, async (req, res) => {
    try {
        const { reviewId } = req.params;
        
        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found"
            });
        }
        
        // Check if user owns this review
        if (review.userId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to delete this review"
            });
        }
        
        const productId = review.productId;
        await Review.findByIdAndDelete(reviewId);
        
        // Update product's average rating
        await updateProductRating(productId);
        
        res.json({
            success: true,
            message: "Review deleted successfully"
        });
        
    } catch (error) {
        console.error("Error deleting review:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== ADD REPLY TO REVIEW ==========
app.post("/reviews/:reviewId/replies", auth, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { text } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Reply text is required"
            });
        }
        
        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found"
            });
        }
        
        const user = await Singup.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        const reply = {
            userId: req.userId,
            userEmail: user.email,
            userName: user.shopName || user.email || 'User',
            text: text.trim(),
            createdAt: new Date()
        };
        
        review.replies.push(reply);
        await review.save();
        
        res.status(201).json({
            success: true,
            message: "Reply added successfully",
            reply: reply
        });
        
    } catch (error) {
        console.error("Error adding reply:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== DELETE REPLY FROM REVIEW ==========
app.delete("/reviews/:reviewId/replies/:replyIndex", auth, async (req, res) => {
    try {
        const { reviewId, replyIndex } = req.params;
        
        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found"
            });
        }
        
        const index = parseInt(replyIndex);
        if (index < 0 || index >= review.replies.length) {
            return res.status(404).json({
                success: false,
                message: "Reply not found"
            });
        }
        
        const reply = review.replies[index];
        
        // Check if user owns this reply
        if (reply.userId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to delete this reply"
            });
        }
        
        review.replies.splice(index, 1);
        await review.save();
        
        res.json({
            success: true,
            message: "Reply deleted successfully"
        });
        
    } catch (error) {
        console.error("Error deleting reply:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== HELPER FUNCTION: Update Product Rating ==========
async function updateProductRating(productId) {
    try {
        const allReviews = await Review.find({ productId: productId });
        const totalReviews = allReviews.length;
        
        let averageRating = 0;
        if (totalReviews > 0) {
            const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
            averageRating = totalRating / totalReviews;
        }
        
        await Product.findByIdAndUpdate(productId, {
            averageRating: averageRating,
            totalReviews: totalReviews
        });
        
    } catch (error) {
        console.error("Error updating product rating:", error);
    }
}


// ============================================
// ========== CHATBOT ROUTE ==========
// ============================================// ============================================
// CHATBOT ROUTE - COMPLETE
// ============================================
// ============================================// ============================================
// CHATBOT ROUTE - REORDERED (FIXED)
// ============================================
app.post("/chat", async (req, res) => {
    try {
        const { message, userId } = req.body;
        const msg = message.toLowerCase();

        // 🔥 Token verification
        const token = req.headers.authorization?.split(' ')[1];
        let authenticatedUserId = userId;

        if (token) {
            try {
                const decoded = jwt.verify(token, "mksecretkey");
                if (decoded.id) {
                    authenticatedUserId = decoded.id;
                }
            } catch (e) {
                // Invalid token, use userId from body
            }
        }

        const finalUserId = authenticatedUserId || userId;

        // ============================================
        // 🔥 STEP 1: CHECK FOR EXACT COMMANDS FIRST!
        // ============================================
        
        // 📊 SALES PREDICTION - MUST BE FIRST!
        if (msg.includes("sales prediction") || 
            msg.includes("predict sales") || 
            msg.includes("future sales") || 
            msg.includes("will i sell") ||
            msg.includes("sales forecast") ||
            msg.includes("prediction")) {
            
            if (!finalUserId) {
                return res.json({
                    reply: "🔐 Please login first to see your sales predictions!\n\n💡 Login to get insights about your future sales."
                });
            }

            try {
                const salesPredictionService = require('./services/salesPredictionService');
                const result = await salesPredictionService.getSalesInsights(finalUserId);
                
                if (!result.success) {
                    return res.json({
                        reply: `📊 **Sales Prediction**\n\n` +
                               `😅 ${result.message}\n\n` +
                               `💡 **Tip:** Start selling to get accurate predictions!\n` +
                               `👉 Add products and get your first order to unlock sales insights.`
                    });
                }

                const confidenceEmoji = result.confidence === 'high' ? '🟢' : 
                                       result.confidence === 'medium' ? '🟡' : '🔴';
                const trendEmoji = result.trend === 'upward' ? '📈' : 
                                  result.trend === 'downward' ? '📉' : '➡️';

                let reply = "📊 **SALES PREDICTION REPORT**\n\n";
                reply += `📈 **Next 30 Days Prediction:**\n`;
                reply += `• Expected Revenue: **PKR ${result.prediction.toFixed(0)}**\n`;
                reply += `• Daily Average: PKR ${result.dailyAverage.toFixed(0)}\n\n`;
                
                reply += `📋 **Current Status:**\n`;
                reply += `• Trend: ${trendEmoji} ${result.trend.toUpperCase()}`;
                if (result.growthRate !== 0) {
                    reply += ` (${result.growthRate > 0 ? '+' : ''}${result.growthRate.toFixed(1)}%)`;
                }
                reply += `\n`;
                reply += `• Confidence: ${confidenceEmoji} ${result.confidence.toUpperCase()}\n`;
                reply += `• Data Points: ${result.dataPoints} days\n\n`;
                
                if (result.topProducts && result.topProducts.length > 0) {
                    reply += `🏆 **Top Products:**\n`;
                    result.topProducts.forEach((p, i) => {
                        reply += `  ${i+1}. ${p.name} (${p.sales} sold, PKR ${p.revenue.toFixed(0)})\n`;
                    });
                    reply += `\n`;
                }
                
                if (result.confidence === 'low' || result.confidence === 'very_low') {
                    reply += `💡 **Tip:** More orders = Better predictions! Keep selling!\n`;
                } else if (result.trend === 'upward') {
                    reply += `🚀 **Great!** Your sales are growing. Keep up the good work!\n`;
                } else if (result.trend === 'downward') {
                    reply += `📌 **Consider:** Optimize prices or add new products to boost sales.\n`;
                } else {
                    reply += `📊 **Stable sales.** Try promoting your products to grow!\n`;
                }
                
                return res.json({ reply });
                
            } catch (error) {
                console.error("Sales prediction error:", error);
                return res.json({
                    reply: "😅 Sorry, I couldn't generate sales prediction right now. Please try again later."
                });
            }
        }

        // 💰 PRICE OPTIMIZATION
        if (msg.includes("optimize") || msg.includes("price") || msg.includes("pricing") || 
            msg.includes("best price") || msg.includes("optimal") || msg.includes("profit")) {
            
            if (!finalUserId) {
                return res.json({
                    reply: "🔐 Please login first to optimize your product prices!\n\n💡 Don't have an account? Sign up now to start selling!"
                });
            }

            try {
                const products = await Product.find({ owner: finalUserId });
                
                if (products.length === 0) {
                    return res.json({
                        reply: "📭 You don't have any products yet! Add some products first to optimize prices.\n\n👉 Go to 'Add Product' to get started!"
                    });
                }

                const priceOptimizationService = require("./services/priceOptimizationService");
                const insights = await priceOptimizationService.getMarketInsights(finalUserId);
                
                if (!insights.success) {
                    return res.json({
                        reply: "😅 Couldn't analyze your products. Please try again later."
                    });
                }

                const { insights: productInsights, summary } = insights;

                let reply = "💰 **PRICE OPTIMIZATION REPORT**\n\n";
                
                reply += `📊 **Summary:**\n`;
                reply += `• Total Products: ${summary.totalProducts}\n`;
                reply += `• Current Total Value: PKR ${summary.totalCurrentValue.toFixed(0)}\n`;
                reply += `• Optimal Total Value: PKR ${summary.totalOptimalValue.toFixed(0)}\n`;
                reply += `• Potential Revenue Increase: **PKR ${summary.potentialRevenueIncrease.toFixed(0)}**\n`;
                reply += `• Average Confidence: ${(summary.averageConfidence * 100).toFixed(0)}%\n\n`;

                const sortedInsights = [...productInsights].sort((a, b) => 
                    Math.abs(b.percentageChange) - Math.abs(a.percentageChange)
                );

                reply += `📋 **Top Recommendations:**\n`;
                sortedInsights.slice(0, 5).forEach((p, i) => {
                    const change = p.percentageChange;
                    const color = change > 0 ? '🟢' : (change < 0 ? '🔴' : '🟡');
                    
                    reply += `${i+1}. ${p.productName}\n`;
                    reply += `   Current: PKR ${p.currentPrice} → Optimal: PKR ${p.optimalPrice} `;
                    reply += `${color} (${change > 0 ? '+' : ''}${change}%)\n`;
                    reply += `   ${p.recommendation}\n\n`;
                });

                return res.json({ reply });

            } catch (error) {
                console.error("Price optimization error:", error);
                return res.json({
                    reply: "😅 Sorry, I couldn't analyze your prices right now. Please try again later."
                });
            }
        }

        // 🏆 BEST SELLERS
        if (msg.includes("best seller") || msg.includes("top selling") || 
            msg.includes("most popular") || msg.includes("most ordered") ||
            msg.includes("bestseller") || msg.includes("top seller")) {
            
            try {
                const topProducts = await Order.aggregate([
                    { $unwind: '$products' },
                    { $match: { status: 'delivered' } },
                    { $group: {
                        _id: '$products.productId',
                        totalSold: { $sum: '$products.quantity' },
                        revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
                    }},
                    { $sort: { totalSold: -1 } },
                    { $limit: 5 }
                ]);
                
                const productIds = topProducts.map(p => p._id);
                const products = await Product.find({ _id: { $in: productIds } })
                    .populate('owner', 'shopName');
                
                if (products.length === 0) {
                    return res.json({
                        reply: "📭 No best sellers yet. Start selling to see your top products!"
                    });
                }
                
                let reply = "🏆 **BEST SELLING PRODUCTS**\n\n";
                
                products.forEach((p, i) => {
                    const top = topProducts.find(t => t._id.toString() === p._id.toString());
                    reply += `${i+1}. ${p.name}\n`;
                    reply += `   🛒 Sold: ${top?.totalSold || 0} units · 💰 PKR ${top?.revenue?.toFixed(0) || 0}\n`;
                    reply += `   ⭐ ${p.averageRating?.toFixed(1) || 'N/A'}/5 · 🏪 ${p.owner?.shopName || 'Unknown'}\n\n`;
                });
                
                return res.json({ reply });
                
            } catch (error) {
                console.error("Best sellers error:", error);
                return res.json({
                    reply: "😅 Sorry, I couldn't fetch best sellers right now."
                });
            }
        }

        // 📦 ORDER STATUS (via Order ID)
        const orderIdMatch = message.match(/[a-f0-9]{24}/i);
        if (orderIdMatch) {
            const orderId = orderIdMatch[0];
            try {
                const order = await Order.findById(orderId).populate("products.productId");
                if (!order) {
                    return res.json({
                        reply: `❌ I couldn't find any order with ID ${orderId}.`
                    });
                }
                const statusLabels = {
                    pending: "🕒 Pending — waiting to be accepted.",
                    accepted: "✅ Accepted — shop is preparing it.",
                    preparing: "👨‍🍳 Preparing — almost ready!",
                    on_the_way: "🚚 On the way — dispatched!",
                    delivered: "📦 Delivered — enjoy!",
                    cancelled: "❌ Cancelled."
                };
                let reply = `📦 Order ID: ${orderId}\n\n${statusLabels[order.status] || order.status}`;
                if (order.statusHistory?.length > 0) {
                    const last = order.statusHistory[order.statusHistory.length - 1];
                    if (last.note) reply += `\n\nNote: ${last.note}`;
                }
                return res.json({ reply });
            } catch (err) {
                return res.json({ reply: `❌ Invalid order ID.` });
            }
        }

        // ============================================
        // 🔥 STEP 2: OTHER COMMANDS
        // ============================================
        
        // 👋 GREETINGS
        if (msg.match(/^(hi|hello|hey|salam|assalam|aoa|good morning|good evening|good afternoon)/i)) {
            return res.json({
                reply: "👋 Assalam o Alaikum! How can I help you today?\n\n💡 Try asking:\n• 'Show me shoes'\n• 'What phones do you have?'\n• 'Optimize my prices'\n• 'Sales prediction'\n• 'Check my order status'\n• 'Return policy'"
            });
        }

        // 🙏 THANKS
        if (msg.includes("thanks") || msg.includes("thank you") || msg.includes("shukriya") || msg.includes("jazakallah") || msg.includes("thanku")) {
            return res.json({
                reply: "😊 You're welcome! Need anything else? Just ask!"
            });
        }

        // 🔄 RETURNS / REFUNDS
        if (msg.includes("return") || msg.includes("refund") || msg.includes("exchange")) {
            return res.json({
                reply: "🔄 You can return products within 7 days after delivery. Contact the shop directly for returns."
            });
        }

        // 🚚 DELIVERY / SHIPPING
        if (msg.includes("delivery") || msg.includes("shipping") || msg.includes("ship") || msg.includes("deliver")) {
            return res.json({
                reply: "🚚 Standard delivery takes 2-5 working days. Express delivery (1-2 days) available at checkout."
            });
        }

        // 💬 ORDER STATUS CHECK (General)
        if (msg.includes("order") || msg.includes("status") || msg.includes("track")) {
            if (finalUserId) {
                const order = await Order.findOne({ owner: finalUserId })
                    .sort({ createdAt: -1 });
                if (!order) {
                    return res.json({
                        reply: "📭 You don't have any orders yet. Start shopping!"
                    });
                }
                return res.json({
                    reply: `📦 Latest order status: ${order.status || 'pending'}\n\nTip: Send me your full order ID to check details.`
                });
            }
            return res.json({
                reply: "📦 To check order status, send your order ID (e.g., 'status of 64f1a2b3...')"
            });
        }

        // 🎯 RECOMMENDATIONS
        if (msg.includes("recommend") || msg.includes("suggest") || 
            msg.includes("what should i buy") || msg.includes("top rated") || 
            msg.includes("trending") || msg.includes("popular")) {
            
            if (!finalUserId) {
                return res.json({
                    reply: "🔐 Please login to get personalized recommendations!\n\n💡 Login to see products you might like based on your shopping history."
                });
            }

            try {
                const UserBehavior = require('./models/UserBehavior');
                
                const viewedProducts = await UserBehavior.distinct('productId', {
                    userId: finalUserId,
                    action: { $in: ['view', 'purchase'] }
                });
                
                const similarUsers = await UserBehavior.aggregate([
                    {
                        $match: {
                            productId: { $in: viewedProducts },
                            userId: { $ne: finalUserId },
                            action: { $in: ['view', 'purchase'] }
                        }
                    },
                    { $group: { _id: '$userId', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 5 }
                ]);
                
                const similarUserIds = similarUsers.map(u => u._id);
                
                const recommendedProductIds = await UserBehavior.aggregate([
                    {
                        $match: {
                            userId: { $in: similarUserIds },
                            productId: { $nin: viewedProducts },
                            action: { $in: ['view', 'purchase'] }
                        }
                    },
                    { $group: {
                        _id: '$productId',
                        score: { $sum: 1 }
                    }},
                    { $sort: { score: -1 } },
                    { $limit: 5 }
                ]);
                
                const productIds = recommendedProductIds.map(p => p._id);
                const recommendedProducts = await Product.find({ _id: { $in: productIds } })
                    .populate('owner', 'shopName');
                
                if (recommendedProducts.length === 0) {
                    const trending = await Product.find()
                        .sort({ averageRating: -1, totalReviews: -1 })
                        .limit(5)
                        .populate('owner', 'shopName');
                    
                    let reply = "🔥 **TRENDING PRODUCTS**\n\n";
                    reply += "Since you're new, here's what's popular right now:\n\n";
                    
                    trending.forEach((p, i) => {
                        reply += `${i+1}. ${p.name} - ⭐${p.averageRating?.toFixed(1) || 'N/A'} - PKR ${p.price}\n`;
                        reply += `   🏪 ${p.owner?.shopName || 'Unknown Shop'}\n\n`;
                    });
                    
                    return res.json({ reply });
                }
                
                let reply = "🎯 **PERSONALIZED RECOMMENDATIONS**\n\n";
                reply += "Based on your shopping history and similar users, you might like:\n\n";
                
                recommendedProducts.forEach((p, i) => {
                    const rating = p.averageRating || 0;
                    const stars = '⭐'.repeat(Math.round(rating));
                    reply += `${i+1}. ${p.name}\n`;
                    reply += `   ${stars} ${rating.toFixed(1)}/5 · PKR ${p.price}\n`;
                    reply += `   🏪 ${p.owner?.shopName || 'Unknown Shop'}\n\n`;
                });
                
                return res.json({ reply });
                
            } catch (error) {
                console.error("Recommendation error:", error);
                return res.json({
                    reply: "😅 Sorry, I couldn't generate recommendations right now. Please try again later."
                });
            }
        }

        // 🔍 SIMILAR PRODUCTS
        if (msg.includes("similar to") || (msg.includes("like") && msg.includes("product"))) {
            const productMatch = msg.match(/similar to (.+)/i) || msg.match(/like (.+)/i);
            if (productMatch) {
                const productName = productMatch[1].trim();
                
                const product = await Product.findOne({
                    name: { $regex: productName, $options: 'i' }
                }).populate('owner', 'shopName');
                
                if (!product) {
                    return res.json({
                        reply: `😅 I couldn't find "${productName}". Please check the name and try again.`
                    });
                }
                
                const similarProducts = await Product.find({
                    _id: { $ne: product._id },
                    $or: [
                        { category: product.category },
                        { name: { $regex: product.name.split(' ')[0], $options: 'i' } }
                    ]
                })
                .limit(5)
                .populate('owner', 'shopName');
                
                if (similarProducts.length === 0) {
                    return res.json({
                        reply: `😅 I couldn't find any products similar to "${productName}". Try searching for something else!`
                    });
                }
                
                let reply = `🔍 **PRODUCTS SIMILAR TO "${product.name}"**\n\n`;
                
                similarProducts.forEach((p, i) => {
                    reply += `${i+1}. ${p.name}\n`;
                    reply += `   💰 PKR ${p.price} · ⭐${p.averageRating?.toFixed(1) || 'N/A'}\n`;
                    reply += `   🏪 ${p.owner?.shopName || 'Unknown Shop'}\n\n`;
                });
                
                return res.json({ reply });
            }
        }

        // ============================================
        // 🔥 STEP 3: PRODUCT SEARCH (LAST!)
        // ============================================
        
        // 🛍️ PRODUCT SEARCH - ONLY IF NOTHING ELSE MATCHED
        const productQuestionPatterns = [
            /(show|find|search|get|list|tell).*?(products|items)/i,
            /(do you have|got|have|sell) (.*?)(\?|$)/i,
            /(find|show|search) (.*?) (products|items)/i,
            /(best|top|good|cheap|expensive) (.*?) (products|items)?/i,
        ];

        let searchQuery = null;

        // ✅ EXCLUDE specific phrases that should NOT trigger product search
        const excludePhrases = ['sales prediction', 'predict sales', 'future sales', 'will i sell'];
        let shouldSearch = true;
        for (const phrase of excludePhrases) {
            if (msg.includes(phrase)) {
                shouldSearch = false;
                break;
            }
        }

        if (shouldSearch) {
            for (const pattern of productQuestionPatterns) {
                const match = msg.match(pattern);
                if (match) {
                    const captured = match[1] || match[2] || match[0];
                    const cleanQuery = captured
                        .replace(/(show|find|search|get|list|tell|best|top|good|cheap|expensive|products|items|available|have|got|sell|do|you|your|the|a|an)/gi, '')
                        .trim();
                    if (cleanQuery.length > 1) {
                        searchQuery = cleanQuery;
                        break;
                    }
                }
            }

            if (!searchQuery && !excludePhrases.some(p => msg.includes(p))) {
                const words = msg.split(' ').filter(w => 
                    !['what', 'is', 'are', 'the', 'a', 'an', 'do', 'you', 'have', 'got', 
                      'sell', 'show', 'find', 'search', 'get', 'list', 'tell', 'about',
                      'for', 'best', 'top', 'good', 'cheap', 'expensive', 'price', 'rate',
                      'cost', 'products', 'items', 'shop', 'available', 'please', 'can',
                      'could', 'would', 'will', 'may', 'should', 'need', 'want', 'looking',
                      'find', 'some', 'any', 'my', 'your', 'their', 'our', 'me', 'us'
                    ].includes(w) && w.length > 2
                );
                
                if (words.length > 0) {
                    searchQuery = words.join(' ');
                }
            }

            if (searchQuery && searchQuery.length > 1) {
                const products = await Product.find({
                    name: { $regex: searchQuery, $options: 'i' }
                }).populate('owner', 'shopName');

                if (products.length === 0) {
                    const words = searchQuery.split(' ');
                    const productPromises = words.map(word => 
                        Product.find({
                            name: { $regex: word, $options: 'i' }
                        }).populate('owner', 'shopName')
                    );
                    
                    const results = await Promise.all(productPromises);
                    const allProducts = results.flat();
                    
                    const uniqueProducts = [];
                    const seen = new Set();
                    for (const p of allProducts) {
                        if (!seen.has(p._id.toString())) {
                            seen.add(p._id.toString());
                            uniqueProducts.push(p);
                        }
                    }
                    
                    if (uniqueProducts.length === 0) {
                        return res.json({
                            reply: `😅 I couldn't find any products matching "${searchQuery}". Try searching for something else!`
                        });
                    }
                    
                    const productsWithReviews = await getProductsWithReviews(uniqueProducts);
                    return res.json({
                        reply: buildProductResponse(productsWithReviews, searchQuery)
                    });
                }

                const productsWithReviews = await getProductsWithReviews(products);
                return res.json({
                    reply: buildProductResponse(productsWithReviews, searchQuery)
                });
            }
        }

        // 📋 BROWSE ALL PRODUCTS
        if (msg.includes("products") || msg.includes("shop") || msg.includes("browse") || msg.includes("catalog") || msg.includes("all")) {
            const products = await Product.find().limit(10).populate('owner', 'shopName');
            if (products.length === 0) {
                return res.json({ reply: "🛒 No products available right now. Check back later!" });
            }
            
            const productsWithReviews = await getProductsWithReviews(products);
            let reply = "🛍️ **Featured Products:**\n\n";
            productsWithReviews.forEach((p, i) => {
                reply += `${i+1}. ${p.name} - ⭐${p.avgRating.toFixed(1)} (${p.totalReviews} reviews) - PKR ${p.price}\n`;
            });
            reply += `\n🔗 Browse all products on our shop page!`;
            return res.json({ reply });
        }

        // ============================================
        // 🤔 DEFAULT / HELP
        // ============================================
        return res.json({
            reply: "🤖 I can help you with:\n\n" +
                   "📊 **Sales Prediction** — ask 'Sales prediction' or 'Will I sell?'\n" +
                   "💰 **Price Optimization** — ask 'Optimize my prices'\n" +
                   "🛍️ **Find Products** — ask 'Show me shoes' or 'What phones do you have?'\n" +
                   "📦 **Order Status** — send your order ID\n" +
                   "🔄 **Returns** — ask 'Return policy'\n" +
                   "🚚 **Delivery** — ask 'Delivery time'\n" +
                   "🎯 **Recommendations** — ask 'Recommend me products'\n" +
                   "🏆 **Best Sellers** — ask 'Best sellers'\n\n" +
                   "Just type your question! 😊"
        });

    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({
            reply: "😅 Sorry, I'm having trouble. Please try again later."
        });
    }
});
// ============================================
// END OF CHATBOT ROUTE
// ============================================
// ============================================
// HELPER FUNCTIONS
// ============================================

// Get products with reviews
async function getProductsWithReviews(products) {
    return await Promise.all(products.map(async (product) => {
        const reviews = await Review.find({ productId: product._id });
        const totalReviews = reviews.length;
        const avgRating = totalReviews > 0 
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
            : 0;
        return {
            ...product.toObject(),
            avgRating: avgRating,
            totalReviews: totalReviews,
            reviewComments: reviews.map(r => r.comment)
        };
    }));
}

// Build product response with clickable links
function buildProductResponse(products, searchQuery) {
    // Sort by rating
    const sorted = products.sort((a, b) => {
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        return b.totalReviews - a.totalReviews;
    });

    const bestProduct = sorted[0];
    
    // Get owner ID
    const getOwnerId = (product) => {
        if (!product.owner) return 'unknown';
        if (typeof product.owner === 'string') return product.owner;
        if (product.owner._id) return product.owner._id;
        return 'unknown';
    };
    
    const ownerId = getOwnerId(bestProduct);
    const productLink = `/product/${ownerId}/${bestProduct._id}`;

    let reply = `🔍 I found <b>${products.length}</b> products matching "<b>${searchQuery}</b>"!<br/><br/>`;
    
    // ★ BEST PRODUCT ★
    reply += `🏆 <b>BEST RECOMMENDATION</b>: ${bestProduct.name}<br/>`;
    reply += `⭐ ${bestProduct.avgRating.toFixed(1)}/5 (${bestProduct.totalReviews} reviews)<br/>`;
    reply += `💰 PKR ${bestProduct.price}<br/>`;
    reply += `🏪 Shop: ${bestProduct.owner?.shopName || 'Unknown'}<br/>`;
    
    if (bestProduct.totalReviews > 0 && bestProduct.reviewComments[0]) {
        const review = bestProduct.reviewComments[0];
        reply += `💬 "${review.substring(0, 60)}${review.length > 60 ? '...' : ''}"<br/>`;
    }
    
    // 🔥 CLICKABLE LINK - BUTTON STYLE
    reply += `<br/>👉 <a href="${productLink}" style="display: inline-block; background: #2563eb; color: white; padding: 8px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 4px;">🔗 View Product</a><br/><br/>`;

    // 📋 Other products
    if (products.length > 1) {
        reply += `📋 <b>Other products:</b><br/>`;
        sorted.slice(1, 4).forEach((p, i) => {
            const pOwnerId = typeof p.owner === 'object' ? p.owner._id : p.owner;
            const pLink = `/product/${pOwnerId || 'unknown'}/${p._id}`;
            reply += `${i+1}. <a href="${pLink}" style="color: #2563eb; text-decoration: underline;">${p.name}</a> - ⭐${p.avgRating.toFixed(1)} (${p.totalReviews} reviews) - PKR ${p.price}<br/>`;
        });
        if (sorted.length > 4) {
            reply += `<br/>... and ${sorted.length - 4} more products!`;
        }
    }
    
    return reply;
}


// Track visitor
app.post('/track', async (req, res) => {
    try {
        const { sessionId, pageVisited, referrer } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        // Check if visitor already exists
        let visitor = await Visitor.findOne({ sessionId });

        if (visitor) {
            // Update existing visitor
            visitor.lastVisit = new Date();
            visitor.visitCount += 1;
            visitor.pageVisited = pageVisited;
            visitor.referrer = referrer || visitor.referrer;
            await visitor.save();
        } else {
            // Create new visitor
            visitor = new Visitor({
                sessionId,
                ipAddress,
                userAgent,
                pageVisited,
                referrer,
                visitedAt: new Date(),
                lastVisit: new Date(),
                visitCount: 1
            });
            await visitor.save();
        }

        res.json({ success: true, visitor });
    } catch (error) {
        console.error('Error tracking visitor:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get visitor statistics
app.get('/stats', async (req, res) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [totalVisitors, todayVisitors, weekVisitors, monthVisitors, activeVisitors] = await Promise.all([
            Visitor.countDocuments(),
            Visitor.countDocuments({ visitedAt: { $gte: today } }),
            Visitor.countDocuments({ visitedAt: { $gte: weekAgo } }),
            Visitor.countDocuments({ visitedAt: { $gte: monthAgo } }),
            Visitor.countDocuments({ lastVisit: { $gte: new Date(now.getTime() - 30 * 60 * 1000) } }) // Last 30 minutes
        ]);

        // Get daily visitors for chart
        const dailyVisitors = await Visitor.aggregate([
            {
                $match: {
                    visitedAt: { $gte: weekAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$visitedAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            stats: {
                total: totalVisitors,
                today: todayVisitors,
                week: weekVisitors,
                month: monthVisitors,
                active: activeVisitors,
                daily: dailyVisitors
            }
        });
    } catch (error) {
        console.error('Error getting visitor stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});



const Setting = require("./models/Setting");
const singup = require("./models/singup");

// ========== INITIALIZE SETTINGS ==========
app.post("/admin/init-settings", async (req, res) => {
    try {
        // Check if setting exists
        let setting = await Setting.findOne({ key: 'payment_required' });
        
        if (!setting) {
            setting = new Setting({
                key: 'payment_required',
                value: true // Default: Payment required
            });
            await setting.save();
        }

        res.json({
            success: true,
            setting: setting
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== GET PAYMENT SETTING ==========
app.get("/admin/payment-setting", async (req, res) => {
    try {
        let setting = await Setting.findOne({ key: 'payment_required' });
        
        if (!setting) {
            // Create default if not exists
            setting = new Setting({
                key: 'payment_required',
                value: true
            });
            await setting.save();
        }

        res.json({
            success: true,
            paymentRequired: setting.value
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== UPDATE PAYMENT SETTING (Admin) ==========
app.put("/admin/payment-setting", async (req, res) => {
    try {
        const { paymentRequired } = req.body;
        
        let setting = await Setting.findOne({ key: 'payment_required' });
        
        if (!setting) {
            setting = new Setting({
                key: 'payment_required',
                value: paymentRequired
            });
        } else {
            setting.value = paymentRequired;
            setting.updatedAt = Date.now();
        }
        
        await setting.save();

        res.json({
            success: true,
            message: paymentRequired ? '✅ Payment Required: ON' : '✅ Payment Required: OFF',
            paymentRequired: setting.value
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== CHECK PAYMENT STATUS (Public) ==========
app.get("/api/payment-status", async (req, res) => {
    try {
        let setting = await Setting.findOne({ key: 'payment_required' });
        
        if (!setting) {
            setting = new Setting({
                key: 'payment_required',
                value: true
            });
            await setting.save();
        }

        res.json({
            success: true,
            paymentRequired: setting.value
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ========== FORGOT PASSWORD - REQUEST OTP ==========
app.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        // Find user by email
        const user = await Singup.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found with this email"
            });
        }

        // Check if OTP is locked
        if (user.resetOTPLocked) {
            if (user.resetOTPLockExpiry && new Date() < user.resetOTPLockExpiry) {
                const remainingMinutes = Math.ceil((user.resetOTPLockExpiry - new Date()) / 60000);
                return res.status(429).json({
                    success: false,
                    message: `Too many attempts. Please try again in ${remainingMinutes} minutes.`
                });
            } else {
                // Unlock if expiry passed
                user.resetOTPLocked = false;
                user.resetOTPAttempts = 0;
                user.resetOTPLockExpiry = null;
                await user.save();
            }
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Set expiry (10 minutes from now)
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        
        // Save OTP to user
        user.resetOTP = otp;
        user.resetOTPExpiry = expiry;
        user.resetOTPAttempts = 0; // Reset attempts
        await user.save();

        // Send OTP via email
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: "🔐 Password Reset OTP",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #2563eb; text-align: center;">Password Reset Request</h2>
                    <p style="text-align: center; font-size: 16px; color: #333;">Hello ${user.shopName || 'User'},</p>
                    <p style="text-align: center; font-size: 16px; color: #333;">You requested to reset your password. Use the OTP below to verify your identity:</p>
                    <div style="text-align: center; padding: 20px; background-color: #f3f4f6; border-radius: 8px; margin: 20px 0;">
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${otp}</span>
                    </div>
                    <p style="text-align: center; font-size: 14px; color: #6b7280;">This OTP will expire in <strong>10 minutes</strong>.</p>
                    <p style="text-align: center; font-size: 14px; color: #6b7280;">If you didn't request this, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                    <p style="text-align: center; font-size: 12px; color: #9ca3af;">© 2025 Shop Management System</p>
                </div>
            `
        });

        res.json({
            success: true,
            message: "OTP sent to your email. It will expire in 10 minutes.",
            email: user.email
        });

    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send OTP. Please try again later."
        });
    }
});

// ========== VERIFY OTP AND RESET PASSWORD ==========
app.post("/verify-reset-otp", async (req, res) => {
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;

        // Validate required fields
        if (!email || !otp || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Check if passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }

        // Check password length
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        // Find user by email
        const user = await Singup.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if OTP is locked
        if (user.resetOTPLocked) {
            if (user.resetOTPLockExpiry && new Date() < user.resetOTPLockExpiry) {
                const remainingMinutes = Math.ceil((user.resetOTPLockExpiry - new Date()) / 60000);
                return res.status(429).json({
                    success: false,
                    message: `Too many attempts. Please try again in ${remainingMinutes} minutes.`
                });
            } else {
                // Unlock if expiry passed
                user.resetOTPLocked = false;
                user.resetOTPAttempts = 0;
                user.resetOTPLockExpiry = null;
                await user.save();
            }
        }

        // Check if OTP exists
        if (!user.resetOTP) {
            return res.status(400).json({
                success: false,
                message: "No OTP request found. Please request a new OTP."
            });
        }

        // Check if OTP is expired
        if (new Date() > user.resetOTPExpiry) {
            // Clear expired OTP
            user.resetOTP = null;
            user.resetOTPExpiry = null;
            await user.save();
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one."
            });
        }

        // Verify OTP
        if (user.resetOTP !== otp) {
            // Increment attempts
            user.resetOTPAttempts += 1;
            
            // Lock after 5 failed attempts
            if (user.resetOTPAttempts >= 5) {
                user.resetOTPLocked = true;
                user.resetOTPLockExpiry = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
                await user.save();
                return res.status(429).json({
                    success: false,
                    message: "Too many failed attempts. Account locked for 30 minutes."
                });
            }
            
            await user.save();
            return res.status(400).json({
                success: false,
                message: `Invalid OTP. ${5 - user.resetOTPAttempts} attempts remaining.`
            });
        }

        // ========== OTP IS CORRECT - RESET PASSWORD ==========
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update user
        user.password = hashedPassword;
        user.resetOTP = null;
        user.resetOTPExpiry = null;
        user.resetOTPAttempts = 0;
        user.resetOTPLocked = false;
        user.resetOTPLockExpiry = null;
        await user.save();

        // Send confirmation email
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: "✅ Password Changed Successfully",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #22c55e; text-align: center;">Password Changed Successfully</h2>
                    <p style="text-align: center; font-size: 16px; color: #333;">Hello ${user.shopName || 'User'},</p>
                    <p style="text-align: center; font-size: 16px; color: #333;">Your password has been successfully changed.</p>
                    <div style="text-align: center; padding: 10px; background-color: #f0fdf4; border-radius: 8px; margin: 20px 0;">
                        <p style="font-size: 14px; color: #16a34a;">✅ If you made this change, no further action is needed.</p>
                    </div>
                    <p style="text-align: center; font-size: 14px; color: #6b7280;">If you didn't change your password, please contact support immediately.</p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                    <p style="text-align: center; font-size: 12px; color: #9ca3af;">© 2025 Shop Management System</p>
                </div>
            `
        });

        res.json({
            success: true,
            message: "Password reset successfully. You can now login with your new password."
        });

    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reset password. Please try again."
        });
    }
});

// ========== RESEND OTP ==========
app.post("/resend-reset-otp", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const user = await Singup.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if locked
        if (user.resetOTPLocked) {
            if (user.resetOTPLockExpiry && new Date() < user.resetOTPLockExpiry) {
                const remainingMinutes = Math.ceil((user.resetOTPLockExpiry - new Date()) / 60000);
                return res.status(429).json({
                    success: false,
                    message: `Too many attempts. Please try again in ${remainingMinutes} minutes.`
                });
            } else {
                user.resetOTPLocked = false;
                user.resetOTPAttempts = 0;
                user.resetOTPLockExpiry = null;
                await user.save();
            }
        }

        // Generate new OTP
        const newOTP = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        user.resetOTP = newOTP;
        user.resetOTPExpiry = expiry;
        user.resetOTPAttempts = 0;
        await user.save();

        // Send new OTP
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: "🔄 New Password Reset OTP",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #2563eb; text-align: center;">New OTP Generated</h2>
                    <p style="text-align: center; font-size: 16px; color: #333;">Hello ${user.shopName || 'User'},</p>
                    <p style="text-align: center; font-size: 16px; color: #333;">Here is your new OTP:</p>
                    <div style="text-align: center; padding: 20px; background-color: #f3f4f6; border-radius: 8px; margin: 20px 0;">
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${newOTP}</span>
                    </div>
                    <p style="text-align: center; font-size: 14px; color: #6b7280;">This OTP will expire in <strong>10 minutes</strong>.</p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                    <p style="text-align: center; font-size: 12px; color: #9ca3af;">© 2025 Shop Management System</p>
                </div>
            `
        });

        res.json({
            success: true,
            message: "New OTP sent to your email."
        });

    } catch (error) {
        console.error("Resend OTP error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to resend OTP. Please try again."
        });
    }
});

// ========== CHECK EMAIL EXISTS ==========
app.post("/check-email", async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const user = await Singup.findOne({ email });
        
        res.json({
            success: true,
            exists: !!user,
            message: user ? "Email found" : "Email not found"
        });

    } catch (error) {
        console.error("Check email error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


app.put("/profile/update", auth, upload.single('image'), async (req, res) => {
    try {
        const { shopName, description, address, phone, email } = req.body;
        
        // Find user
        const user = await Singup.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if email is being changed and already exists
        if (email && email !== user.email) {
            const existingEmail = await Singup.findOne({ 
                email: email,
                _id: { $ne: req.userId } // Exclude current user
            });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: "This email is already registered with another account"
                });
            }
            user.email = email;
        }

        // Check if shop name is being changed and already exists
        if (shopName && shopName.trim() !== '' && shopName !== user.shopName) {
            const existingShop = await Singup.findOne({ 
                shopName: shopName.trim(),
                _id: { $ne: req.userId }
            });
            if (existingShop) {
                return res.status(400).json({
                    success: false,
                    message: "This shop name is already taken. Please choose another."
                });
            }
            user.shopName = shopName.trim();
        }

        // Update other fields
        if (description !== undefined) {
            user.description = description || '';
        }
        if (address !== undefined) {
            user.address = address || '';
        }
        if (phone !== undefined) {
            user.phone = phone || '';
        }

        // Handle image upload
        if (req.file) {
            // Delete old image from Cloudinary
            if (user.publicId) {
                try {
                    await cloudinary.uploader.destroy(user.publicId);
                } catch (err) {
                    console.log("Old image deletion failed:", err.message);
                }
            }
            user.image = req.file.path;
            user.publicId = req.file.filename;
        }

        await user.save();

        // Return updated user without password
        const updatedUser = await Singup.findById(req.userId).select("-password");

        res.json({
            success: true,
            message: "Profile updated successfully! ✅",
            user: updatedUser
        });

    } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


const Ad = require("./models/Ad")
app.post("/adhero" ,auth,upload.single('adhero'), async(req,res)=>{
    try{
        const shopId = req.userId;
        if(req.userId !== shopId){
            return res.status(403).json({
                success:false,
                message:"Not authorized"
            })
        }
        const adhero = await Ad.findOne({ userId: shopId });
        if(!adhero){
            res.status(403).json({
                succes:false,
                message:"shop not found"
            })
        }
        adhero.adhero = req.file.path;
        adhero.adpublicId =req.file.filename;
        adhero.productUrl=req.body.productUrl;
        adhero.shopUrl=req.body.shopUrl;
        await adhero.save();
        res.json({
            success:true,
            message:"Ad succfully uploaded",
            adHero :adhero.adhero
        })
    }catch(error){
          console.error("Adhero error:", error);
        res.status(500).json({
            success:false,
            message:error.message
        })
    }
})
app.get("/ads",async(req,res)=>{
    try{
        const ads =await Ad.find({
      adhero: { $exists: true, $ne: null }
    }).select("adhero , productUrl , shopUrl");
        res.send({
            success:true,
            ads 
        })

    }catch(error){
        res.status(500).json({
            success:false,
            message:error.message
        })
    }
})

app.get("/top-rated", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const products = await Product.find()
            .sort({
                averageRating: -1,
                totalReviews: -1
            })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json(products);

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
});

app.get("/search", async (req, res) => {
    try {
        const q = req.query.q;

        const products = await Product.find({
            name: { $regex: q, $options: "i" }
        }).limit(10);

        const shops = await Singup.find({
            shopName: { $regex: q, $options: "i" }
        }).limit(10);

        res.json({
            products,
            shops
        });

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
});


server.listen(3000, () => {
    console.log("🚀 Server running on port 3000");
    console.log("✅ All routes ready!");
});