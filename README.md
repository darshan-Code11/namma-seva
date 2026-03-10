# NAMMA SEVA – Bengaluru Civic Navigator

Namma Seva is a comprehensive web portal designed to simplify access to Bengaluru's civic and government services. Emphasizing ease of use, transparency, and accessibility, the platform allows citizens to seamlessly apply for civic documents without middlemen or long queues.

## ✨ Features

- **Civic Services Directory:** Apply for essential services like Khata Transfer, Birth/Death Certificates, Trade Licenses, Ration Cards, and more through a unified smart interface.
- **Bilingual Support (English & Kannada):** Fully translated UI, making it accessible to all citizens of Karnataka. The language preference persists across sessions.
- **NAMMA SEVA AI (Chatbot):** 
  - Powered by **Grok AI**, providing 24/7 intelligent assistance regarding government services.
  - **🗣️ Voice-to-Text:** Speak your queries directly using your microphone (Web Speech API integration).
  - **🔊 Text-to-Speech (TTS):** The AI reads its responses out loud in both English and Kannada natively in the browser.
- **Mock DigiLocker Authentication:** A simulated DigiLocker login flow that fetches essential documents like Aadhaar, PAN, and Driving Licence.
- **Google OAuth Integration:** Secure and fast sign-ins utilizing Google accounts, backed by Passport.js.
- **Application Tracking System:** Real-time monitoring of active applications using a dedicated Reference Number.
- **Payment Gateway UI:** A fully mock-integrated RazorPay Government Gateway simulator for fee processing.

## 🛠️ Technologies Used

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (Single Page Application architecture)
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Authentication:** Passport.js (Google OAuth2.0), Express Sessions
- **AI & APIs:** Grok API (xAI), native Browser Web Speech API (Speech Recognition & Synthesis)

## 🚀 Installation and Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/darshan-Code11/namma-seva.git
   cd namma-seva
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and populate it with your API keys:
   ```env
   PORT=3000
   MONGODB_URI=your_mongodb_cluster_uri
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GROK_API_KEY=your_grok_api_key
   SESSION_SECRET=a_very_secure_secret
   ```

4. **Start the development server:**
   ```bash
   node server.js
   ```
   The application will run locally at `http://localhost:3000`.

## 🤝 Contributing

Contributions are welcome! If you have suggestions or improvements, please fork the repository and create a pull request or open an issue.

## 📜 License

This project is licensed under the MIT License.
