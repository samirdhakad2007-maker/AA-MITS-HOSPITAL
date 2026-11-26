# AA.MITS Hospital Management System

AA.MITS is a hospital-management project with a browser portal and a separate C++ console application. The portal uses Express, Node.js, and SQLite. Its frontend is served by the same Express server as its API.

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
- Portal server: Express and Node.js `node:sqlite`.
- Passwords: salted scrypt hashes; no shared demo passwords are included.
- Console application: C++17 and CMake.

## Project structure

```text
AA.MITS/
├── .env.example             # Names of optional server environment variables
├── .gitignore               # Excludes local data, secrets, and build output
├── CMakeLists.txt           # C++ console-app build configuration
├── client/                  # Browser portal files served by Express
│   ├── index.html
│   ├── portal.js
│   └── hospital-login.png
├── main.cpp                 # C++ console application
├── package.json             # Node.js project metadata
├── server.js                # Portal server and API
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
npm install
npm start
```

The `.env` file is optional and must stay local; `.env.example` contains development settings and no secrets. Set `ADMIN_FULL_NAME`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in `.env` to choose the first administrator credentials. If they are blank, the server creates a random temporary password and prints it once in the server console. When the database has no patient or doctor records, the server inserts dummy demo records.

Open `http://localhost:3000` on the same computer. `GET /api/health` (and `/healthz`) returns a small JSON health response for hosting-provider checks. The portal and API share one origin, so no separate frontend URL or CORS configuration is needed.

### Deploy the existing portal on Render

Deploy this as one Node.js web service; do not deploy the frontend separately to Vercel. In the Render service settings use:

- Root directory: repository root (leave blank if the repository itself is the project root).
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`
- Environment variables:
  - `HOST=0.0.0.0`
  - `NODE_ENV=production`
  - `COOKIE_SECURE=true`
  - `DB_PATH=/tmp/hospital_portal.sqlite`
  - `ADMIN_FULL_NAME=<your full name>`
  - `ADMIN_USERNAME=<your admin username>`
  - `ADMIN_PASSWORD=<a secret password of at least 12 characters>`

Render supplies `PORT`; do not set it to a fixed value. This free demo deployment uses an ephemeral filesystem, so SQLite accounts and records may be lost after a restart or redeploy; the app reseeds its initial demo account and records when the database is empty. Do not enter real patient information. After deploying, use the public HTTPS URL Render assigns to open the login portal from any device.

There are no `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, or `VITE_API_URL` settings in this project: it uses SQLite and same-origin, cookie-based sessions. The C++ console application is separate and is not included in this web deployment.

### Demo accounts and data

For a demo, use the administrator credentials set in Render's environment variables. If they were not set before the first start, the generated temporary administrator password is printed in the service logs. Users can sign up from the portal, then the administrator approves their accounts. Use dummy patient and billing data only.

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

The portal listens on `0.0.0.0` and uses the hosting provider's `PORT` value (or port 3000 locally). This starter project has not had a professional healthcare-security or privacy review. Do not enter real patient information without appropriate access controls, secure backups, audit logging, and compliance review.

## License

No license has been selected or included. All rights are reserved by the project owner unless a license is added.
