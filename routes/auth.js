const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const { sendEmail } = require('../utils/email');

/**
 * 🔐 SIGNUP PAGE
 */
router.get('/signup', (req, res) => {
    res.render('signup');
});

/**
 * 🔐 SIGNUP LOGIC
 */
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.render('signup', { error: 'All fields are required' });
        }

        let user;
        try {
            user = await User.findOne({ email });
        } catch (dbErr) {
            console.error('DB FAIL (Signup check):', dbErr.message);
            req.session.user = { _id: 'guest-' + Date.now(), username, email };
            req.session.favorites = [];
            return res.redirect('/');
        }

        if (user) {
            return res.render('signup', { error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const newUser = new User({ 
                username, 
                email, 
                password: hashedPassword, 
                likedSongs: [],
                isVerified: false,
                verificationToken
            });
            await newUser.save();

            const baseUrl = process.env.BASE_URL; // 🚀 Imported strictly from Jenkins pipeline
            const verificationUrl = `${baseUrl}/verify?token=${verificationToken}`;

            // ✅ Wait for email to send so we can catch errors
            console.log(`✉️ Sending mail with [PIPELINE ADDR: ${baseUrl}]`);
            try {
                await sendEmail({
                    to: email,
                    subject: `[PIPELINE: ${baseUrl}] Verify your MusicApp account`,
                    text: `Hello ${username},\n\nPlease verify your email by clicking the following link: ${verificationUrl}`,
                    html: `<h3>Hello ${username},</h3><p>Please verify your email by clicking the following link:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`
                });
                res.render('login', { success: `Signup successful! A verification link has been sent to: ${email}. Please check your inbox (and spam folder) before logging in.` });
            } catch (mailErr) {
                console.error('❌ Email failed to send:', mailErr.message);
                // Inform the user precisely why it failed
                return res.render('signup', { 
                    error: `Signup partially succeeded, but verification email failed to send: ${mailErr.message}. Please check your SMTP settings.` 
                });
            }
        } catch (saveErr) {
            console.error('DB SAVE FAIL:', saveErr.message);
            req.session.user = { _id: 'guest-' + Date.now(), username, email };
            req.session.favorites = [];
            res.redirect('/');
        }

    } catch (err) {
        console.error('Signup runtime error:', err);
        res.render('signup', { error: 'Something went wrong. Please try again.' });
    }
});

/**
 * 🔐 LOGIN PAGE
 */
router.get('/login', (req, res) => {
    res.render('login');
});

/**
 * 🔐 LOGIN LOGIC — loads saved favorites from MongoDB
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.render('login', { error: 'Email and password are required' });
        }

        let user;
        try {
            user = await User.findOne({ email });
        } catch (dbErr) {
            console.error('DB FAIL (Login):', dbErr.message);
            // Fallback to guest mode if DB is unreachable
            req.session.user = {
                _id: 'guest-' + Date.now(),
                username: email.split('@')[0],
                email
            };
            req.session.favorites = [];
            return res.redirect('/');
        }

        if (!user) {
            return res.render('login', { error: 'Account not found. Please sign up first.' });
        }

        if (user.isVerified === false) {
            return res.render('login', { error: 'Please verify your email address. Check your inbox for the verification link.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('login', { error: 'Incorrect password' });
        }

        // ✅ Set session with user info
        req.session.user = { _id: user._id, username: user.username, email: user.email };

        // ✅ LOAD saved favorites from MongoDB into session
        req.session.favorites = user.likedSongs || [];

        console.log(`✅ User "${user.username}" logged in with ${req.session.favorites.length} saved favorites.`);
        res.redirect('/');

    } catch (err) {
        console.error('Login runtime error:', err);
        res.render('login', { error: 'An unexpected error occurred.' });
    }
});

/**
 * 🚪 LOGOUT
 */
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

/**
 * ✅ VERIFY EMAIL ROUTE
 */
router.get('/verify', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.render('login', { error: 'Invalid or missing verification token.' });
        }

        const user = await User.findOne({ verificationToken: token });
        if (!user) {
            return res.render('login', { error: 'Verification link is invalid or has expired.' });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        await user.save();

        res.render('login', { success: 'Your email has been successfully verified. You can now log in.' });
    } catch (err) {
        console.error('Verification error:', err);
        res.render('login', { error: 'An unexpected error occurred during verification.' });
    }
});

/**
 * 🛠️ DIAGNOSTIC ROUTE - FOR DEBUGGING ONLY
 */
const { transporter } = require('../utils/email');
router.get('/debug-email', async (req, res) => {
    let output = "=== 📧 EMAIL DIAGNOSTICS ===\n\n";
    
    // 1. Check Variables
    output += "1. Environment Check:\n";
    output += `   - SMTP_HOST: ${process.env.SMTP_HOST || 'NOT SET (Defaulting to smtp.gmail.com)'}\n`;
    output += `   - SMTP_PORT: ${process.env.SMTP_PORT || 'NOT SET'}\n`;
    output += `   - SMTP_USER: ${process.env.SMTP_USER || 'MISSING'}\n`;
    output += `   - SMTP_PASS: ${process.env.SMTP_PASS ? 'PRESENT (Length: ' + process.env.SMTP_PASS.length + ')' : 'MISSING'}\n`;
    output += `   - FROM_EMAIL: ${process.env.FROM_EMAIL || 'MISSING'}\n`;
    output += `   - BASE_URL: ${process.env.BASE_URL || 'NOT SET (Defaulting to request host)'}\n\n`;

    // 2. Test Connection
    output += "2. Testing Connection (transporter.verify())...\n";
    try {
        await transporter.verify();
        output += "   ✅ SUCCESS: Connection verified!\n\n";
        
        // 3. Test Send
        output += "3. Testing Test Mail Send...\n";
        await transporter.sendMail({
            from: process.env.FROM_EMAIL,
            to: process.env.SMTP_USER,
            subject: 'MusicApp Debug Result',
            text: 'If you see this, email is working!'
        });
        output += "   ✅ SUCCESS: Test email sent to " + process.env.SMTP_USER + "\n";
    } catch (err) {
        output += `   ❌ ERROR: ${err.message}\n`;
        if (err.stack) output += `\nStack Trace:\n${err.stack}\n`;
    }

    output += "\n=== DIAGNOSTICS COMPLETE ===";
    res.type('text/plain').send(output);
});

module.exports = router;