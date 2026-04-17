# Vibraphone

Vibraphone is a collaborative color-field app. Each phone user picks the color that matches how they feel in the moment, the backend stores those submissions, and the shared collage evolves into a communal Rothko-like painting over time.

## Architecture

- `src/main/java`: Spring Boot backend with a REST API and H2 persistence.
- `mobile-app`: React + Vite client designed for touch input and ready to package with Capacitor for iOS and Android.
- `data/`: local H2 database created at runtime.

## Backend API

- `POST /api/colors/submissions`: submit a color choice.
- `GET /api/colors/submissions?limit=8`: fetch the latest submissions.
- `GET /api/colors/collage?width=6&height=8&hours=72`: build the shared collage from recent activity.

Example submission payload:

```json
{
  "deviceId": "2b2c9f24-42f7-4d58-9c8f-bcbbad771246",
  "hexColor": "#D46A79",
  "x": 0.12,
  "y": 0.30
}
```

## Run Locally

### 1. Start the backend

```bash
mvn spring-boot:run
```

The API will be available at `http://localhost:8080`.

### 2. Start the React client

```bash
cd mobile-app
npm install
npm run dev
```

The mobile client will be available at `http://localhost:5173`.

### One-command preview on Windows

From the project root, run:

```powershell
.\start-preview.cmd
```

This opens two PowerShell windows, one for the Spring Boot backend and one for the React frontend. Leave both windows open, then open `http://localhost:5173` in your browser.

If you are testing on a physical phone, set `mobile-app/.env` so `VITE_API_BASE_URL` points to your computer's LAN IP instead of `localhost`, for example:

```bash
VITE_API_BASE_URL=http://192.168.1.25:8080
```

The backend already allows common localhost, Capacitor, and private-LAN origins by default. If your network setup is stricter, adjust `app.cors.allowed-origins` in `src/main/resources/application.yml`.

## Package For iOS Or Android

The frontend is wired for Capacitor, which lets you ship the React app as an installable mobile app.

```bash
cd mobile-app
npm install
npm run build
npx cap add android
npx cap add ios
npm run cap:sync
```

Then open the native projects:

```bash
npm run cap:android
npm run cap:ios
```

From there you build and sign the app in Android Studio or Xcode.

## Notes On The Collage

- The backend stores each submission with device ID, palette position, color, and timestamp.
- The collage endpoint buckets recent submissions into a grid and blends each cell into a soft color field.
- Empty cells are synthesized from the global average plus a subtle accent so the composition still feels painterly when traffic is light.
