const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    try {
        // Try to get token from different possible locations
        let token = req.headers.token;  // Custom header
        if (!token) {
            token = req.headers.authorization?.split(" ")[1];  // Bearer token
        }
        if (!token) {
            token = req.cookies?.token;  // Cookie token (if using cookies)
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "No token provided"
            });
        }
        
        const decoded = jwt.verify(token, "mksecretkey");
        req.userId = decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};