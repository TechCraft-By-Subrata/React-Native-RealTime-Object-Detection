![Real-Time Detection Banner](./featured_image.png)

# Real-Time Detection

A React Native app for on-device visual intelligence using **VisionCamera** + **ExecuTorch**.

This project includes:
- Single-frame classification with `EfficientNet V2 S`
- Real-time object detection overlays with `YOLO26N`
- On-device inference (no cloud inference required)
- Basic model management UI for download/readiness status

## Demo Flows

1. **Model Management**
- Check model readiness
- Download and warm up YOLO26N
- Inspect downloaded model files

2. **Scan Item**
- Capture a still frame
- Run image classification
- Show top label and confidence

3. **Realtime Detection**
- Process camera frames continuously
- Detect multiple objects with threshold tuning
- Render bounding boxes and labels on live preview

## Tech Stack

- React Native `0.81.5`
- React `19.1.0`
- TypeScript
- `react-native-vision-camera`
- `react-native-executorch`
- `react-native-worklets`
- `react-native-safe-area-context`

## Project Structure

```text
realtimedetection/
├── App.tsx
├── src/
│   ├── components/          # Shared UI fallbacks
│   ├── constants/           # Detection and model constants
│   ├── hooks/               # Reusable hooks (e.g. downloaded models)
│   ├── screens/             # Screen-level UI and orchestration
│   ├── styles/              # Shared StyleSheet definitions
│   ├── types/               # Domain types
│   └── utils/               # Pure utility functions
├── android/
├── ios/
└── __tests__/
```

## Architecture Notes

- `App.tsx` handles only app-level orchestration and screen switching.
- Screen modules are separated by responsibility:
  - `HomeScreen`
  - `ModelManagementScreen`
  - `ScannerScreen`
  - `RealtimeDetectionScreen`
- Shared logic is extracted into hooks and utilities to keep screens focused and DRY.
- Detection post-processing is isolated in utilities for easier testing and evolution.

## Prerequisites

Before running the app, ensure your environment is set up for React Native development:
- Node.js `>= 20`
- Android Studio and/or Xcode
- CocoaPods (for iOS)
- React Native environment dependencies: [official setup guide](https://reactnative.dev/docs/set-up-your-environment)

## Installation

```sh
npm install
```

### iOS only

```sh
bundle install
bundle exec pod install --project-directory=ios
```

## Running the App

Start Metro:

```sh
npm start
```

In a second terminal:

```sh
npm run android
# or
npm run ios
```

## Available Scripts

- `npm start` - start Metro bundler
- `npm run android` - build/run on Android
- `npm run ios` - build/run on iOS
- `npm run lint` - run ESLint
- `npm test` - run Jest tests

## Model Behavior

- Classification uses `EFFICIENTNET_V2_S`.
- Realtime detection uses `YOLO26N`.
- Realtime screen performs multi-pass detection thresholds to improve recall of smaller/near objects.
- On iOS, model readiness uses downloaded-model checks plus warmup flow.
- On Android, YOLO readiness is currently treated as available by platform branch logic.

## Troubleshooting

### Camera permission blocked

If camera access is denied:
- Open system settings for the app
- Re-enable camera permission
- Restart app if needed

### Jest fails with Watchman permission errors

If you see Watchman-related failures in restricted environments, run:

```sh
npm test -- --watch=false --watchman=false
```

### Jest fails on `react-native-executorch` ESM imports

Current Jest config may require additional transform/mocking setup for some `node_modules` packages (including `react-native-executorch`). If tests fail with `Cannot use import statement outside a module`, update Jest `transformIgnorePatterns` or provide module mocks.

## Development Guidelines

- Keep business logic in hooks/utils, not screen components.
- Prefer pure utility functions for detection math and mapping.
- Maintain SRP boundaries:
  - UI in screens/components
  - stateful side effects in hooks
  - data transforms in utilities

## Contributing

1. Create a feature branch
2. Make focused changes with clear responsibility boundaries
3. Run type-check/lint/tests locally
4. Open a PR with a concise change summary

## License

Internal project / not yet licensed for public distribution.
