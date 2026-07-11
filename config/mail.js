const nodemailer =require("nodemailer")

const transporter = nodemailer.createTransport({
    service:"gmail",
    host: 'smtp.gmail.com', // or your SMTP host
  port: 465,
  secure: true,
  family: 4,
    auth:{
        user:process.env.EMAIL,
        pass:process.env.EMAIL_PASS
    }
    
})


module.exports = transporter