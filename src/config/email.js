const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function sendPasswordResetEmail(toEmail, resetToken) {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    const mailOptions = {
        from: '"Lexcol Support" <support@lexcol.com>',
        to: toEmail,
        subject: 'Reset your Lexcol password',
        html: `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your Lexcol account.</p>
            <p>Click the link below to set a new password. This link is valid for 1 hour.</p>
            <a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#1a1a1a;color:white;text-decoration:none;border-radius:6px;">Reset Password</a>
            <p>If you didn't request this, you can safely ignore this email.</p>
        `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent: %s', info.messageId);
    // If using Ethereal, log the preview URL so you can click it in the console
    if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
}

module.exports = { sendPasswordResetEmail };