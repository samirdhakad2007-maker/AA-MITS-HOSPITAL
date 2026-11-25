# AA.MITS Hospital Management System

AA.MITS is a hospital-management project with a browser portal and a separate C++ console application. The portal uses a small built-in Node.js server and SQLite; it does not currently use React, Vite, Express, or MongoDB.

## Features

### Administrator

- Manage patients, doctors, appointments, rooms and beds, billing, pharmacy, medical records, and staff.
- Review and approve new user sign-up requests.
- Update the display name shown on the dashboard.

### User

- Manage patient and appointment records.
- View the other hospital sections.
- Sign up for an account; an administrator must approve it before the account can sign in.

## Technology stack

- Browser portal: HTML, CSS, and JavaScript.
- Portal server: Node.js built-in HTTP server and `node:sqlite`.
- Passwords: salted scrypt hashes; no shared demo passwords are included.
- Console application: C++17 and CMake.

## Project structure

```text
AA.MITS/
├── .env.example             # Names of optional server environment variables
├── .gitignore               # Excludes local data, secrets, and build output
├── CMakeLists.txt           # C++ console-app build configuration
├── index.html               # Portal page
├── main.cpp                 # C++ console application
├── package.json             # Node.js project metadata
├── portal.js                # Portal frontend behavior
├── server.js                # Portal server and API
├── hospital-login.png       # Portal background artwork
├── hospital_data.txt        # Local console data; ignored by Git
├── hospital_portal.sqlite   # Generated portal database; ignored by Git
└── build/                   # Generated CMake output; ignored by Git
```

## Run the browser portal

### Requirements

- Node.js 22.13 or newer.
- Git, to clone the repository.

### Setup

```powershell
git clone <REPOSITORY_URL>
Set-Location AA.MITS
Copy-Item .env.example .env
npm start
```

This project has no third-party Node packages, so installing dependencies is not required. The `.env` file is optional and must stay local; `.env.example` contains development settings and no secrets. The portal and API are served from the same origin, so there is no separate frontend API URL or CORS configuration.

Open `http://127.0.0.1:4173` on the same computer. `GET /healthz` returns a small JSON health response for hosting-provider checks; `/` remains the portal page. On the first run, the server prints a one-time administrator setup code. Keep it private, enter it on the setup page, and create an administrator account with a password of at least 12 characters. The setup code is not a reusable login password.

### Deploy the existing portal on Render

Deploy this as one Node.js web service; do not deploy the frontend separately to Vercel. In the Render service settings use:

- Root directory: repository root (leave blank if the repository itself is the project root).
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/healthz`
- Environment variables:
  - `HOST=0.0.0.0`
  - `NODE_ENV=production`
  - `COOKIE_SECURE=true`
  - `PORTAL_DB_PATH=/data/hospital_portal.sqlite`
  - `ADMIN_FULL_NAME=<your full name>`
  - `ADMIN_USERNAME=<your admin username>`
  - `ADMIN_PASSWORD=<a secret password of at least 12 characters>`

Render supplies `PORT`; do not set it to a fixed value. Attach a persistent disk mounted at `/data` so SQLite accounts and records survive service restarts and redeploys. The disk must be available to the service plan you select. After deploying, use the public HTTPS URL Render assigns to open the login portal from any device.

There are no `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, or `VITE_API_URL` settings in this project: it uses SQLite and same-origin, cookie-based sessions. The C++ console application is separate and is not included in this web deployment.

### Demo accounts and data

There are no built-in usernames or passwords. For a demo, create a throwaway administrator account with dummy information. Users can sign up from the portal, then the administrator approves their accounts. Use dummy patient and billing data only.

Portal accounts and records are saved in `hospital_portal.sqlite`. The C++ console application separately saves to `hospital_data.txt`. Neither local data file should be uploaded to GitHub.

## Run the C++ console application

### Requirements

- CMake 3.16 or newer.
- A C++17 compiler.
- Visual Studio 2022 or newer with C++ desktop development tools.

From the project root, run:

```powershell
cmake -S . -B build -G "Visual Studio 17 2022"
cmake --build build --config Release
.\build\Release\hms.exe
```

For Visual Studio 2026, replace the generator with `-G "Visual Studio 18 2026"`.

## Network and data safety

By default, the portal listens only on `127.0.0.1` and is available on the server computer. This starter project has not had a professional healthcare-security or privacy review. Do not expose it directly to the internet or enter real patient information without appropriate HTTPS hosting, access controls, secure backups, audit logging, and compliance review.

## License

No license has been selected or included. All rights are reserved by the project owner unless a license is added.
