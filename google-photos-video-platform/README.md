# Google Photos Video Platform

A modern, serverless video streaming platform using Google Photos API.

## Features
- **Serverless**: Uses Google Photos API for storage and retrieval.
- **Local State**: Likes and playlists stored in localStorage/IndexedDB.
- **Secure**: OAuth 2.0 PKCE flow.
- **Modern UI**: Dark mode, glassmorphism, responsive design.

## Setup

1. **Prerequisites**: Node.js installed.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Environment**:
   Copy `.env.example` to `.env` and fill in your Google Client ID.
4. **Run**:
   ```bash
   npm run dev
   ```

## Structure
- `/public`: HTML entry points.
- `/src`: Source code (JS, CSS, Components).
