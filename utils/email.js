const nodemailer = require('nodemailer');

// Create a transporter using the settings from the .env file
console.log('📧 Audit: Email variables loaded:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  passLength: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0,
  from: process.env.FROM_EMAIL
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 465, 
  secure: true, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Sends an email
 */
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `Your Music App <${process.env.FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    console.log(`🚀 Attempting to send email to: ${options.to}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log('📬 SMTP Response:', info.response);
    console.log('🆔 Message ID:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Nodemailer Error:', error.message);
    throw error;
  }
};

module.exports = {
  sendEmail,
  transporter,
};
