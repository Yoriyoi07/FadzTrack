const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', // Example: using Gmail
    auth: {
        user: process.env.EMAIL_USER, // Your email (from .env)
        pass: process.env.EMAIL_PASS  // Your password (from .env)
    }
});

const sendMail = async (to, subject, text) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        text: text
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

module.exports = sendMail;
