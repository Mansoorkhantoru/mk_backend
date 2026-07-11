const transporter = require('./mail');
const dotenv = require('dotenv');
dotenv.config();
const Singup = require('../models/singup'); 
// Send order confirmation to customer
const sendOrderConfirmationEmail = async (order) => {
    try {
        const statusLabels = {
            pending: '🕒 Pending',
            accepted: '✅ Accepted',
            preparing: '👨‍🍳 Preparing',
            on_the_way: '🚚 On the way',
            delivered: '📦 Delivered',
            cancelled: '❌ Cancelled'
        };

        let productsList = '';
        order.products.forEach((item, index) => {
            const product = item.productId;
            productsList += `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${product ? product.name : 'Product'}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.quantity}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">PKR ${item.price || 0}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">PKR ${(item.price || 0) * (item.quantity || 1)}</td>
                </tr>
            `;
        });

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #667eea; }
                    .header h1 { color: #667eea; margin: 0; }
                    .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
                    .status-pending { background: #ffd93d; color: #333; }
                    .status-accepted { background: #6bcb77; color: white; }
                    .status-preparing { background: #4d96ff; color: white; }
                    .status-on_the_way { background: #ff6b6b; color: white; }
                    .status-delivered { background: #00b894; color: white; }
                    .status-cancelled { background: #e74c3c; color: white; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th { background: #667eea; color: white; padding: 10px; text-align: left; }
                    td { padding: 8px; border-bottom: 1px solid #eee; }
                    .total { font-size: 18px; font-weight: bold; text-align: right; padding: 10px; border-top: 2px solid #667eea; }
                    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
                    .btn { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🛍️ Order Confirmation</h1>
                        <p>Thank you for your order!</p>
                    </div>
                    
                    <div style="margin: 20px 0;">
                        <h3>Order Details</h3>
                        <p><strong>Order ID:</strong> ${order._id}</p>
                        <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                        <p><strong>Status:</strong> 
                            <span class="status-badge status-${order.status}">
                                ${statusLabels[order.status] || order.status}
                            </span>
                        </p>
                    </div>

                    <div style="margin: 20px 0;">
                        <h3>Delivery Details</h3>
                        <p><strong>Name:</strong> ${order.customerName}</p>
                        <p><strong>Email:</strong> ${order.customerEmail}</p>
                        <p><strong>Phone:</strong> ${order.customerPhone}</p>
                        <p><strong>Address:</strong> ${order.shippingAddress}</p>
                        ${order.city ? `<p><strong>City:</strong> ${order.city}</p>` : ''}
                        ${order.orderNotes ? `<p><strong>Notes:</strong> ${order.orderNotes}</p>` : ''}
                    </div>

                    <div style="margin: 20px 0;">
                        <h3>Products</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${productsList}
                            </tbody>
                        </table>
                        <div class="total">
                            Total Amount: PKR ${order.totalAmount || 0}
                        </div>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${order._id}" class="btn">View Order</a>
                    </div>

                    <div class="footer">
                        <p>Thank you for shopping with us!</p>
                        <p>If you have any questions, please contact the shop.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await transporter.sendMail({
            from: process.env.EMAIL,
            to: order.customerEmail,
            subject: `Order Confirmation #${order._id}`,
            html: emailHtml
        });

        console.log(`✅ Order confirmation email sent to ${order.customerEmail}`);

    } catch (error) {
        console.error("Email send error:", error);
    }
};

// Send order status update email
const sendOrderStatusUpdateEmail = async (order, oldStatus, newStatus) => {
    try {
        const statusLabels = {
            pending: '🕒 Pending',
            accepted: '✅ Accepted',
            preparing: '👨‍🍳 Preparing',
            on_the_way: '🚚 On the way',
            delivered: '📦 Delivered',
            cancelled: '❌ Cancelled'
        };

        const statusMessages = {
            accepted: 'Your order has been accepted by the shop! 🎉',
            preparing: 'Your order is being prepared! 👨‍🍳',
            on_the_way: 'Your order is on the way to you! 🚚',
            delivered: 'Your order has been delivered! 📦',
            cancelled: 'Your order has been cancelled. ❌'
        };

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
                    .header { padding-bottom: 20px; border-bottom: 2px solid #667eea; }
                    .header h1 { color: #667eea; margin: 0; }
                    .status-icon { font-size: 60px; margin: 20px 0; }
                    .status-badge { display: inline-block; padding: 10px 24px; border-radius: 20px; font-weight: bold; margin: 10px 0; font-size: 18px; }
                    .status-accepted { background: #6bcb77; color: white; }
                    .status-preparing { background: #4d96ff; color: white; }
                    .status-on_the_way { background: #ff6b6b; color: white; }
                    .status-delivered { background: #00b894; color: white; }
                    .status-cancelled { background: #e74c3c; color: white; }
                    .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                    .footer { padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📦 Order Update</h1>
                    </div>
                    
                    <div class="status-icon">
                        ${newStatus === 'accepted' ? '✅' : 
                          newStatus === 'preparing' ? '👨‍🍳' : 
                          newStatus === 'on_the_way' ? '🚚' : 
                          newStatus === 'delivered' ? '📦' : 
                          newStatus === 'cancelled' ? '❌' : '📋'}
                    </div>

                    <h2>Order #${order._id}</h2>
                    
                    <p style="font-size: 18px; color: #333;">
                        ${statusMessages[newStatus] || `Order status: ${statusLabels[newStatus]}`}
                    </p>

                    <div>
                        <span class="status-badge status-${newStatus}">
                            ${statusLabels[newStatus] || newStatus}
                        </span>
                    </div>

                    <div style="margin: 20px 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <p style="margin: 5px 0;"><strong>Order Total:</strong> PKR ${order.totalAmount || 0}</p>
                        <p style="margin: 5px 0;"><strong>Customer:</strong> ${order.customerName}</p>
                    </div>

                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${order._id}" class="btn">View Order Details</a>

                    <div class="footer">
                        <p>Thank you for shopping with us!</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await transporter.sendMail({
            from: process.env.EMAIL,
            to: order.customerEmail,
            subject: `Order Update #${order._id} - ${statusLabels[newStatus] || newStatus}`,
            html: emailHtml
        });

        console.log(`✅ Status update email sent to ${order.customerEmail}`);

    } catch (error) {
        console.error("Status email send error:", error);
    }
};

// Send notification to shop owner
const sendShopOwnerOrderNotification = async (order) => {
    try {
        const shopOwner = await Singup.findById(order.owner);
        if (!shopOwner) return;

        const shopOwnerEmail = shopOwner.email;
        const shopName = shopOwner.shopName || 'Shop Owner';

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #ff6b6b; }
                    .header h1 { color: #ff6b6b; margin: 0; }
                    .order-details { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
                    .btn { display: inline-block; padding: 12px 24px; background: #ff6b6b; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                    .footer { padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🆕 New Order Received!</h1>
                    </div>
                    
                    <h2>Hello ${shopName}!</h2>
                    <p>You have received a new order!</p>

                    <div class="order-details">
                        <p><strong>Order ID:</strong> ${order._id}</p>
                        <p><strong>Customer:</strong> ${order.customerName}</p>
                        <p><strong>Email:</strong> ${order.customerEmail}</p>
                        <p><strong>Phone:</strong> ${order.customerPhone}</p>
                        <p><strong>Address:</strong> ${order.shippingAddress}</p>
                        <p><strong>Total Amount:</strong> PKR ${order.totalAmount || 0}</p>
                        <p><strong>Products:</strong> ${order.products.length} items</p>
                    </div>

                    <div style="text-align: center;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/shop-orders" class="btn">View All Orders</a>
                    </div>

                    <div class="footer">
                        <p>Manage your orders from the dashboard.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        if (shopOwnerEmail) {
            await transporter.sendMail({
                from: process.env.EMAIL,
                to: shopOwnerEmail,
                subject: `🆕 New Order #${order._id}`,
                html: emailHtml
            });
            console.log(`✅ Shop owner notification sent to ${shopOwnerEmail}`);
        }

    } catch (error) {
        console.error("Shop owner email error:", error);
    }
};

const sendShopDeletionNotification = async (shop, reason, adminEmail) => {
    try {
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #dc3545; }
                    .header h1 { color: #dc3545; margin: 0; }
                    .reason-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                    .reason-box p { color: #856404; margin: 0; }
                    .deleted-items { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
                    .deleted-items ul { list-style-type: none; padding: 0; }
                    .deleted-items li { padding: 5px 0; color: #555; }
                    .deleted-items li:before { content: "❌ "; }
                    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚨 Shop Deleted</h1>
                        <p>Your shop has been removed from the platform</p>
                    </div>
                    
                    <h2>Hello ${shop.shopName || 'Shop Owner'}!</h2>
                    <p>Your shop <strong>"${shop.shopName}"</strong> has been deleted from the platform.</p>

                    <div class="reason-box">
                        <p><strong>Reason for deletion:</strong> ${reason || 'Admin request'}</p>
                    </div>

                    <div class="deleted-items">
                        <h3>📋 What Was Deleted:</h3>
                        <ul>
                            <li>Shop: ${shop.shopName}</li>
                            <li>All Products (${shop.productCount || 0} items)</li>
                            <li>All Reviews</li>
                            <li>All Orders</li>
                        </ul>
                    </div>

                    <div style="background: #cce5ff; border-left: 4px solid #004085; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <p style="color: #004085; margin: 0;">
                            <strong>📝 Note:</strong> All your data has been permanently removed. 
                            If you believe this was a mistake, please contact admin at ${adminEmail || 'admin@shop.com'}
                        </p>
                    </div>

                    <div class="footer">
                        <p>This is an automated message from your shop management system.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await transporter.sendMail({
            from: process.env.EMAIL,
            to: shop.email,
            subject: `🚨 Your Shop "${shop.shopName}" Has Been Deleted`,
            html: emailHtml
        });

        console.log(`✅ Shop deletion notification sent to ${shop.email}`);
        return true;

    } catch (error) {
        console.error("Shop deletion notification error:", error);
        return false;
    }
};

// 2. Send product deletion notification
const sendProductDeletionNotification = async (product, reason, adminEmail) => {
    try {
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #dc3545; }
                    .header h1 { color: #dc3545; margin: 0; }
                    .reason-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                    .reason-box p { color: #856404; margin: 0; }
                    .product-details { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
                    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚨 Product Deleted</h1>
                        <p>Your product has been removed from the platform</p>
                    </div>
                    
                    <h2>Hello ${product.owner?.shopName || 'Shop Owner'}!</h2>
                    <p>Your product <strong>"${product.name}"</strong> has been deleted from the platform.</p>

                    <div class="reason-box">
                        <p><strong>Reason for deletion:</strong> ${reason || 'Admin request'}</p>
                    </div>

                    <div class="product-details">
                        <h3>📋 Deleted Product:</h3>
                        <p><strong>Name:</strong> ${product.name}</p>
                        <p><strong>Price:</strong> PKR ${product.price}</p>
                        <p><strong>Description:</strong> ${product.description || 'No description'}</p>
                    </div>

                    <div style="background: #cce5ff; border-left: 4px solid #004085; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <p style="color: #004085; margin: 0;">
                            <strong>📝 Note:</strong> All reviews for this product have also been removed.
                            If you believe this was a mistake, please contact admin at ${adminEmail || 'admin@shop.com'}
                        </p>
                    </div>

                    <div class="footer">
                        <p>This is an automated message from your shop management system.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await transporter.sendMail({
            from: process.env.EMAIL,
            to: product.owner?.email,
            subject: `🚨 Product "${product.name}" Has Been Deleted`,
            html: emailHtml
        });

        console.log(`✅ Product deletion notification sent to ${product.owner?.email}`);
        return true;

    } catch (error) {
        console.error("Product deletion notification error:", error);
        return false;
    }
};

// ========== EXPORT ALL FUNCTIONS ==========
module.exports = {
    // Existing functions
    sendOrderConfirmationEmail,
    sendOrderStatusUpdateEmail,
    sendShopOwnerOrderNotification,
    
    // New notification functions
    sendShopDeletionNotification,
    sendProductDeletionNotification
};