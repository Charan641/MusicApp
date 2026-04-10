require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, 
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Failed:', err.message));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: true
}));

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

const authRoutes = require('./routes/auth');
const musicRoutes = require('./routes/music');

app.use('/', authRoutes);
app.use('/', musicRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});