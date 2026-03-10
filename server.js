require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns');

// Fix for MongoDB SRV DNS lookup issues
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Session & Passport Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'namma_seva_secret',
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
    // For now, just pass the profile through
    return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/?auth=failed' }),
    (req, res) => {
        // Successful authentication
        res.redirect('/?auth=success');
    }
);

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

app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

const mongoose = require('mongoose');

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.error('Full Error:', err);
    });

// Define Application Schema
const applicationSchema = new mongoose.Schema({
    service: mongoose.Schema.Types.Mixed,
    formData: mongoose.Schema.Types.Mixed,
    refNumber: String,
    uploadedDocs: mongoose.Schema.Types.Mixed,
    status: { type: Number, default: 1 },
    date: { type: Date, default: Date.now }
});

const Application = mongoose.model('Application', applicationSchema);

app.post('/api/applications', async (req, res) => {
    try {
        const newApp = new Application(req.body);
        await newApp.save();
        res.status(201).json({ success: true, message: 'Application submitted', application: newApp });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/applications', async (req, res) => {
    try {
        const applications = await Application.find().sort({ date: -1 });
        res.json(applications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'namma-seva.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
