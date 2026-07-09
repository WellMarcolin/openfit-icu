# OpenFit ICU

Training dashboard powered by Intervals.icu with OpenCode AI assistant.

## Overview

OpenFit ICU is a web-based training dashboard that integrates with [Intervals.icu](https://intervals.icu) to provide comprehensive training analytics for athletes. It features an AI-powered health assistant built with [OpenCode](https://opencode.ai) to help you analyze your training data, understand trends, and make informed decisions about your training.

Based on the UI/UX design of [OpenFit](https://github.com/FlavioAdamo/openfit), adapted for training and performance data.

## Features

- **Training Dashboard**: View CTL, ATL, TSB, training load, and fitness trends
- **Activity Analysis**: Detailed workout metrics with intervals, power zones, and compliance
- **Fitness Charts**: Performance Management Chart (PMC) with CTL/ATL/TSB history
- **Power Curves**: Analyze your power profile and FTP progression
- **Wellness Tracking**: Monitor HRV, sleep, mood, stress, and readiness
- **Training Calendar**: Plan workouts and track upcoming events
- **AI Assistant**: Chat with your training data using OpenCode AI (Zen/Go models)
- **Customizable**: Configure dashboards, prompts, and metrics

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 8
- **UI**: shadcn/ui + Radix UI + Tailwind CSS v4
- **Charts**: Custom SVG charts (LineChart, ColumnChart, RadialProgress)
- **Chat**: assistant-ui
- **Backend**: Vercel Serverless Functions
- **Data Source**: Intervals.icu API (113 endpoints)
- **AI Backend**: OpenCode Server (serve mode)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- Intervals.icu account (free or premium)
- OpenCode Server (for AI assistant)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/openfit-icu.git
cd openfit-icu

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
# - Intervals.icu OAuth credentials
# - OpenCode Server URL

# Start development server
npm run dev
```

### Environment Variables

```env
# Intervals.icu OAuth
INTERVALS_ICU_CLIENT_ID=your_client_id
INTERVALS_ICU_CLIENT_SECRET=your_client_secret
INTERVALS_ICU_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback

# Intervals.icu API Key (alternative to OAuth — also configurable via Settings UI)
INTERVALS_ICU_API_KEY=your_api_key

# OpenCode Server (also configurable via Settings UI)
OPENCODE_SERVER_URL=http://localhost:4096
OPENCODE_SERVER_USERNAME=opencode
OPENCODE_SERVER_PASSWORD=your_password

# LLM Provider (via OpenCode)
OPENCODE_ZEN_API_KEY=your_zen_key
OPENCODE_ZEN_MODEL=anthropic/claude-sonnet-4-5
```

## Project Structure

```
openfit-icu/
  api/                    # Vercel Serverless Functions
    auth/                 # OAuth endpoints
    data/                 # Intervals.icu API proxy
    assistant/            # OpenCode AI bridge
    settings.ts           # Settings API (cookie-based config)
  src/
    components/
      Views.tsx           # Dashboard views (Today, Activity, Fitness, etc.)
      Charts.tsx          # Custom chart components
      Shared.tsx          # Reusable UI components
      HealthAssistant.tsx # AI chat panel
      Settings/           # Settings dialog (Data Source + AI Assistant)
    data/
      demo.ts             # Demo data generator
      normalize.ts        # Data normalizer
  lib/
    intervals-icu.ts    # Intervals.icu API client (at api/lib/intervals-icu.ts)
    opencode-client.ts  # OpenCode SDK wrapper (at api/lib/opencode-client.ts)
    types.ts              # TypeScript types
  prompts/
    health-assistant.txt  # AI system prompt
  vercel.json             # Vercel configuration
```

## Development

```bash
# Start dev server
npm run dev

# Type check
npm run typecheck

# Run tests
npm run test

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Self-hosted

```bash
npm run build
npx serve dist
```

## API Endpoints

### Auth
- `GET /api/auth/login` - Start OAuth flow
- `GET /api/auth/callback` - OAuth callback
- `POST /api/auth/logout` - Clear session

### Data (Intervals.icu proxy)
- `GET /api/data/athlete` - Athlete profile
- `GET /api/data/activities` - Activity list
- `GET /api/data/wellness` - Wellness data
- `GET /api/data/power-curves` - Power curves
- `GET /api/data/events` - Calendar events

### Assistant (OpenCode)
- `POST /api/assistant/chat` - Send message
- `POST /api/assistant/session` - Create session
- `GET /api/assistant/stream` - SSE stream
- `GET /api/assistant/config` - Check assistant availability

### Settings
- `GET /api/settings` - Read user config (cookies)
- `POST /api/settings` - Save user config (httpOnly cookies)

## Customization

### AI Assistant Prompt

Edit `prompts/health-assistant.txt` to customize the AI assistant's behavior.

### Dashboard Configuration

Configure dashboards via Settings > Dashboards in the UI.

## Roadmap

- [ ] Multi-sport support
- [ ] Comparison mode
- [ ] Notifications (FTP, best efforts)
- [ ] Coach view (multi-athlete)
- [ ] PWA offline mode
- [x] Write operations (create/edit workouts + step builder + schedule)
- [x] Workout builder
- [x] Data export (CSV/JSON + image)
- [x] Intervals.icu connection (OAuth + API Key via Settings UI)
- [x] Health Assistant LLM parameterization (URL/username/password via Settings UI)

## License

MIT

## Credits

- UI/UX inspired by [OpenFit](https://github.com/FlavioAdamo/openfit)
- Data from [Intervals.icu](https://intervals.icu)
- AI powered by [OpenCode](https://opencode.ai)
