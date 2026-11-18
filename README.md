# LET - Life Events Tracker

A habit and life-event tracker for Android, iPhone and the web. Most habit apps only record "did you do it". LET also records numbers and notes, like hours slept, glasses of water or how your day felt, and then shows you patterns across all of them. It works offline, keeps everything on your device, and needs no account.

**Download:** the Android app is on the [releases page](https://github.com/p32929/let/releases/latest).

## Screenshots

| Onboarding | Home | Dashboard | Patterns |
|:----------:|:----:|:---------:|:--------:|
| [![Onboarding](https://res.cloudinary.com/p32929/image/upload/c_scale,h_200/v1764069334/LET/886cfe1c-1193-4a66-be71-661001a8c376.png)](https://res.cloudinary.com/p32929/image/upload/v1764069334/LET/886cfe1c-1193-4a66-be71-661001a8c376.png) | [![Home](https://res.cloudinary.com/p32929/image/upload/c_scale,h_200/v1764069682/LET/99a23514-d776-4a29-afd9-a700ab6b252e.png)](https://res.cloudinary.com/p32929/image/upload/v1764069682/LET/99a23514-d776-4a29-afd9-a700ab6b252e.png) | [![Dashboard](https://res.cloudinary.com/p32929/image/upload/c_scale,h_200/v1764069728/LET/d77e1726-84ad-47f7-ab7b-f013dd2967e5.png)](https://res.cloudinary.com/p32929/image/upload/v1764069728/LET/d77e1726-84ad-47f7-ab7b-f013dd2967e5.png) | [![Patterns](https://res.cloudinary.com/p32929/image/upload/c_scale,h_200/v1764069699/LET/4a9290a4-f80d-400b-bfce-3c9d621f1071.png)](https://res.cloudinary.com/p32929/image/upload/v1764069699/LET/4a9290a4-f80d-400b-bfce-3c9d621f1071.png) |

## Features

1. **Track anything.** Yes/no habits, numbers (sleep hours, water, workouts) and short notes (mood, important events).
2. **See patterns.** Charts show how your events relate to each other over time.
3. **Forecast.** LET guesses what is likely in the next 14 days from your own history: the day of the week, your recent days and things that repeat every few days. Each guess shows a % chance (or a likely value) and a short reason, like "Happened on 8 of the last 10 Mondays". It needs 14 days of tracking first.
4. **Week view** with a calendar picker and swipe gestures to move between weeks.
5. **Your data stays yours.** Everything is saved in a local database on your device. Nothing goes to the cloud.
6. **Back up and move your data** with export and import (JSON).
7. **Your own colors** for each event, and light and dark mode.

## Good to know

1. LET is still being built, so expect some rough edges.
2. I built it to try React Native and Expo on iPhone, Android and the web from one codebase, and it was written almost entirely by talking to an AI (Claude).

## Build it yourself

### What you need

1. Node.js 18+
2. Yarn or npm
3. Expo CLI
4. iOS Simulator / Android Emulator / Physical device

### Run it

```bash
# Clone the repository
git clone https://github.com/p32929/let.git
cd let

# Install dependencies
yarn install

# Start the development server
yarn dev

# Or for specific platforms
yarn ios     # iOS
yarn android # Android
yarn web     # Web
```

Built with React Native, Expo, TypeScript, NativeWind, SQLite (expo-sqlite with Drizzle ORM) and Zustand.

## License

MIT License.

## Contributing

Contributions are very welcome, thank you! Before you start on a pull request, please open an issue and tell me what you would like to add or change. That way we can agree on it first, and your time is not wasted on something that might not fit. Thanks for helping make LET better.

## You might also like

<p><a href="https://openstore.pfay.workers.dev/cards/p32929/0?n=4&amp;repo=let"><picture><source media="(prefers-color-scheme: dark)" srcset="https://openstore.pfay.workers.dev/cards/p32929/0.svg?n=4&amp;repo=let&amp;theme=dark"><img src="https://openstore.pfay.workers.dev/cards/p32929/0.svg?n=4&amp;repo=let&amp;theme=light" width="50%" align="top" alt="More apps by p32929 on OpenStore (1)"></picture></a><a href="https://openstore.pfay.workers.dev/cards/p32929/1?n=4&amp;repo=let"><picture><source media="(prefers-color-scheme: dark)" srcset="https://openstore.pfay.workers.dev/cards/p32929/1.svg?n=4&amp;repo=let&amp;theme=dark"><img src="https://openstore.pfay.workers.dev/cards/p32929/1.svg?n=4&amp;repo=let&amp;theme=light" width="50%" align="top" alt="More apps by p32929 on OpenStore (2)"></picture></a><br><a href="https://openstore.pfay.workers.dev/cards/p32929/2?n=4&amp;repo=let"><picture><source media="(prefers-color-scheme: dark)" srcset="https://openstore.pfay.workers.dev/cards/p32929/2.svg?n=4&amp;repo=let&amp;theme=dark"><img src="https://openstore.pfay.workers.dev/cards/p32929/2.svg?n=4&amp;repo=let&amp;theme=light" width="50%" align="top" alt="More apps by p32929 on OpenStore (3)"></picture></a><a href="https://openstore.pfay.workers.dev/cards/p32929/3?n=4&amp;repo=let"><picture><source media="(prefers-color-scheme: dark)" srcset="https://openstore.pfay.workers.dev/cards/p32929/3.svg?n=4&amp;repo=let&amp;theme=dark"><img src="https://openstore.pfay.workers.dev/cards/p32929/3.svg?n=4&amp;repo=let&amp;theme=light" width="50%" align="top" alt="More apps by p32929 on OpenStore (4)"></picture></a></p>

<p><a href="https://p32929.github.io/share/?repo=let"><picture><source media="(prefers-color-scheme: dark)" srcset="https://p32929.github.io/readme/footer-share-dark.svg"><img src="https://p32929.github.io/readme/footer-share-light.svg" width="50%" align="top" alt="Share this project with your friends in one click"></picture></a><a href="https://p32929.github.io/support/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://p32929.github.io/readme/footer-support-dark.svg"><img src="https://p32929.github.io/readme/footer-support-light.svg" width="50%" align="top" alt="If you like my work and want to support me, feel free to support"></picture></a><br><a href="https://openstore.pfay.workers.dev/add"><picture><source media="(prefers-color-scheme: dark)" srcset="https://p32929.github.io/readme/footer-join-dark.svg"><img src="https://p32929.github.io/readme/footer-join-light.svg" width="100%" align="top" alt="Put your own apps on OpenStore: free, your listing lives in your own repo"></picture></a></p>
