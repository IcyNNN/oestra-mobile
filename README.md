# Oestra Mobile

Oestra (潮汐) mobile app built with Expo and React Native.

## Tech Stack

- Expo
- TypeScript
- NativeWind
- Supabase
- Anthropic API

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ANTHROPIC_API_KEY=
```

3. Start development server:

```bash
npx expo start
```

## Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `EXPO_PUBLIC_ANTHROPIC_API_KEY`: Anthropic API key for chat
