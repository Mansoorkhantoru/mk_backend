const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({
    host: '74.125.200.108', // Gmail's IPv4 address (current)
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
    }
})

module.exports = transporter