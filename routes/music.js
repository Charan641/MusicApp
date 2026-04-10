const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');

const CLIENT_ID = process.env.JAMENDO_CLIENT_ID;

function isAuthenticated(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

let playlist = [];

router.get('/', isAuthenticated, async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        let url = `https://api.jamendo.com/v3.0/tracks/?client_id=${CLIENT_ID}&format=json&limit=20`;
        if (searchQuery) url += `&namesearch=${encodeURIComponent(searchQuery)}`;
        const response = await axios.get(url);
        const songs = response.data.results || [];
        res.render('index', {
            title: 'Music Stream',
            songs,
            favorites: req.session.favorites || [],
            search: searchQuery,
            user: req.session.user
        });
    } catch (error) {
        console.error('HOME ERROR:', error);
        res.status(500).send('Error loading home page');
    }
});

router.post('/playlist', isAuthenticated, (req, res) => {
    const song = req.body;
    if (!song || !song.id) return res.status(400).json({ success: false });
    const exists = playlist.find(s => s.id == song.id);
    if (!exists) playlist.push(song);
    res.json({ success: true, playlist });
});

router.post('/like', isAuthenticated, async (req, res) => {
    try {
        const { songId, title, artist, audioUrl, image } = req.body;

        if (!req.session.favorites) req.session.favorites = [];

        const existsInSession = req.session.favorites.find(f => f.songId == songId);

        if (!existsInSession) {
            // Add to session
            req.session.favorites.push({ songId, title, artist, audioUrl, image });

            // Save to MongoDB (skip for guest users)
            const userId = req.session.user._id;
            if (!String(userId).startsWith('guest-')) {
                await User.findByIdAndUpdate(userId, {
                    $push: { likedSongs: { songId, title, artist, audioUrl, image } }
                });
            }
            console.log(`❤️ Liked: ${title}`);
        } else {
            // Remove from session
            req.session.favorites = req.session.favorites.filter(f => f.songId != songId);

            // Remove from MongoDB (skip for guest users)
            const userId = req.session.user._id;
            if (!String(userId).startsWith('guest-')) {
                await User.findByIdAndUpdate(userId, {
                    $pull: { likedSongs: { songId } }
                });
            }
            console.log(`💔 Unliked: ${title}`);
        }

        res.json({ success: true, favorites: req.session.favorites });

    } catch (err) {
        console.error('Like error:', err);
        res.status(500).json({ success: false });
    }
});

router.get('/favorites', isAuthenticated, async (req, res) => {
    try {
        res.render('favorites', {
            title: 'My Favorites',
            songs: req.session.favorites || [],
            user: req.session.user
        });
    } catch (err) {
        console.error('Favorites error:', err);
        res.status(500).send('Error loading favorites');
    }
});

router.get('/recommendations/:artist', isAuthenticated, async (req, res) => {
    try {
        const artist = decodeURIComponent(req.params.artist);
        const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${CLIENT_ID}&format=jsonpretty&limit=21&artist_name=${encodeURIComponent(artist)}`;
        const response = await axios.get(url);
        const songs = response.data.results || [];
        res.render('recommendations', {
            title: `Tracks like ${artist}`,
            artist,
            songs,
            favorites: req.session.favorites || [],
            user: req.session.user
        });
    } catch (err) {
        console.error('Recommendations error:', err);
        res.status(500).send('Error fetching recommendations');
    }
});

router.get('/api/similar', isAuthenticated, async (req, res) => {
    try {
        const artist = req.query.artist || '';
        let tracks = [];

        if (artist) {
            const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${CLIENT_ID}&format=json&limit=15&artist_name=${encodeURIComponent(artist)}`;
            const response = await axios.get(url);
            tracks = response.data.results || [];
        }

        if (tracks.length === 0) {
            const fallbackUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${CLIENT_ID}&format=json&limit=15&order=popularity_total`;
            const fallbackRes = await axios.get(fallbackUrl);
            tracks = fallbackRes.data.results || [];
        }

        res.json({ tracks });
    } catch (err) {
        console.error('Similar tracks error:', err);
        res.status(500).json({ tracks: [] });
    }
});

router.get('/playlist', isAuthenticated, (req, res) => {
    res.render('playlist', {
        title: 'My Playlist',
        songs: playlist,
        user: req.session.user
    });
});

module.exports = router;