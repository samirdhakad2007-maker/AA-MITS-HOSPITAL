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
npm install
Copy-Item .env.example .env
node server.js
```

`npm install` is included for a standard Node.js setup; this version has no third-party Node packages. The `.env` file is optional and must stay local. The server reads it when present; `.env.example` contains variable names only.

Open `http://127.0.0.1:4173` on the same computer. On the first run, the server prints a one-time administrator setup code. Keep it private, enter it on the setup page, and create an administrator account with a password of at least 12 characters. The setup code is not a reusable login password.

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
