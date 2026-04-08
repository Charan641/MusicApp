const express = require('express');
const bcrypt = require('bcrypt');
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
            const newUser = new User({ username, email, password: hashedPassword, likedSongs: [] });
            await newUser.save();

            // ✅ Send welcome email asynchronously
            sendEmail({
                to: email,
                subject: 'Welcome to MusicApp!',
                text: `Hello ${username},\n\nThank you for signing up for MusicApp! We hope you enjoy the best tunes.`,
                html: `<h3>Hello ${username},</h3><p>Thank you for signing up for <strong>MusicApp</strong>!</p><p>We hope you enjoy the best tunes.</p>`
            }).catch(err => console.error('Failed to send welcome email:', err));

            res.redirect('/login');
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

module.exports = router;