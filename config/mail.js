// const nodemailer = require("nodemailer")
// const transporter = nodemailer.createTransport({
//     host: 'smtp.gmail.com',
//     port: 465,
//     secure: true, // changed to true for 465
//     family: 4,
//     auth: {
//         user: process.env.EMAIL,
//         pass: process.env.EMAIL_PASS
//     }
// })
// module.exports = transporter



const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const transporter = {
    sendMail: async ({ from, to, subject, html, text }) => {
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev', // shuru mein testing ke liye yehi use karo
            to,
            subject,
            html,
            text
        });

        if (error) {
            console.error("❌ Resend error:", error);
            throw new Error(error.message || "Email send failed");
        }

        console.log("✅ Email sent via Resend:", data?.id);
        return data;
    }
};

module.exports = transporter;