require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MongoStoreRaw = require('connect-mongo');
const MongoStore = MongoStoreRaw.default || MongoStoreRaw;

// Fix for MongoDB SRV DNS lookup issues
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ═══════════════════════════════════════════════════════════
// DATABASE CONNECTION
// ═══════════════════════════════════════════════════════════
// Explicitly target the 'namaseva' database
const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const mongoURI = baseUri.replace(/\/+$/, '') + '/namaseva';

if (!process.env.MONGODB_URI) {
    console.warn("⚠️  WARNING: MONGODB_URI environment variable is missing!");
}
// Override TLS to allow connections from machines with SSL inspection / older certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
})
    .then(() => console.log('✅ Connected to MongoDB Atlas → namaseva'))
    .catch(err => console.error('❌ MongoDB connection error:', err.message));

// ═══════════════════════════════════════════════════════════
// SCHEMAS & MODELS  (must be defined BEFORE routes)
// ═══════════════════════════════════════════════════════════

// Users — one doc per Google account; tracks login count
const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },
    name: String,
    email: String,
    avatar: String,
    loginCount: { type: Number, default: 0 },
    firstLogin: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Applications — one doc per submitted form
const applicationSchema = new mongoose.Schema({
    service: mongoose.Schema.Types.Mixed,
    formData: mongoose.Schema.Types.Mixed,
    refNumber: String,
    uploadedDocs: mongoose.Schema.Types.Mixed,
    userEmail: String,   // who submitted it
    status: { type: Number, default: 1 },
    date: { type: Date, default: Date.now }
});
const Application = mongoose.model('Application', applicationSchema);

// ═══════════════════════════════════════════════════════════
// SESSION & PASSPORT
// ═══════════════════════════════════════════════════════════
app.use(session({
    secret: process.env.SESSION_SECRET || 'namma_seva_secret',
    resave: false,
    saveUninitialized: false,
    store: (typeof MongoStore.create === 'function')
        ? MongoStore.create({ mongoUrl: mongoURI, collectionName: 'sessions', ttl: 14 * 24 * 60 * 60 })
        : new MongoStore({ mongoUrl: mongoURI, collectionName: 'sessions', ttl: 14 * 24 * 60 * 60 }),
    cookie: {
        maxAge: 14 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Google OAuth strategy — saves/updates user in DB on every login
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    proxy: true
}, async (accessToken, refreshToken, profile, done) => {
    try {
        await User.findOneAndUpdate(
            { googleId: profile.id },
            {
                $set: {
                    name: profile.displayName,
                    email: profile.emails?.[0]?.value,
                    avatar: profile.photos?.[0]?.value,
                    lastLogin: new Date()
                },
                $inc: { loginCount: 1 },
                $setOnInsert: { firstLogin: new Date() }
            },
            { upsert: true, new: true }
        );
        console.log(`👤 Login recorded for: ${profile.displayName}`);
    } catch (err) {
        console.error('❌ Error saving user login:', err.message);
    }
    return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ═══════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/?auth=failed' }),
    (req, res) => res.redirect('/?auth=success')
);

app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

// ═══════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════

// Current logged-in user info
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                name: req.user.displayName,
                email: req.user.emails?.[0]?.value,
                avatar: req.user.photos?.[0]?.value,
                provider: 'Google'
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// All users with login stats (visible in Atlas as 'users' collection)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().sort({ lastLogin: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit a new application
app.post('/api/applications', async (req, res) => {
    try {
        const newApp = new Application(req.body);
        await newApp.save();
        console.log(`📄 New application saved: ${newApp.refNumber}`);
        res.status(201).json({ success: true, message: 'Application submitted', application: newApp });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get all applications
app.get('/api/applications', async (req, res) => {
    try {
        const applications = await Application.find().sort({ date: -1 });
        res.json(applications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Chat (Groq AI)
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Groq API Error:', response.status, errorBody);
            return res.status(response.status).json({ error: 'AI Service Error' });
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Chat API exception:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Serve main HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'namma-seva.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);

    // KEEP-ALIVE: Ping the server every 14 minutes to prevent Render free tier from sleeping
    const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
    if (RENDER_EXTERNAL_URL) {
        const https = require('https');
        console.log(`📡 Keep-alive initialized for: ${RENDER_EXTERNAL_URL}`);
        setInterval(() => {
            https.get(RENDER_EXTERNAL_URL, (res) => {
                console.log(`🔁 Keep-alive ping sent. Status: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error('❌ Keep-alive error:', err.message);
            });
        }, 14 * 60 * 1000); // 14 mins (Render sleeps after 15 mins of inactivity)
    }
});
