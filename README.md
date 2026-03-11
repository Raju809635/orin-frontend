# ORIN Frontend (Expo React Native)

ORIN mobile app frontend for students and mentors.

## Current Product UI

### Bottom tabs
- `Dashboard`
- `Mentorship`
- `Network`
- `AI`
- `Community`

### Side drawer (minimal)
- `Domains`
- `Daily Quiz`
- `AI Assistant`
- `News & Updates`
- `Collaborate with ORIN`
- `Settings`

### Key feature groups
- Mentor discovery and booking
- Session and payment status tracking
- Social network style feed (posts, reactions, comments, shares, saves)
- AI tools (mentor matching, skill gap, roadmap, project ideas, resume builder, assistant)
- Community modules (challenges, certifications, internships, leaderboard, knowledge library)
- Daily quiz, reputation, and growth tracking

## Run Locally

```bash
npm install
npx expo start
```

## Environment

Set in `.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-backend-url
```

## OTA Update

Preview OTA update:

```bash
npm run update:preview
```

Production OTA update:

```bash
npm run update
```

## Native Build

When native dependencies change, create a new build:

```bash
eas build -p android --profile production
```

Use `.aab` for Play Store uploads.

## User Documentation

See full user-facing guide:
- `ORIN_USER_GUIDE.md`
