# ⌚ TaskFlow for Google Wear OS

> **Glance. Tap. Conquer.**  
> Native Wear OS companion for TaskFlow, built with Jetpack Compose for Wear OS, glanceable Tiles (Protolayout), and Watch Face Complications.

---

## 🌟 Capabilities

1. **Wrist Task Checklist (Jetpack Compose):**
   - Rotary scroll support (`ScalingLazyColumn`).
   - One-tap duty checkoff with haptic vibration feedback.
   - Priority dot indicators (Critical, High, Medium, Low).
   - Voice quick-add with speech-to-text dictation.

2. **Glanceable Wear OS Tile (`TaskFlowTileService`):**
   - Swipe left from your watch face to view remaining duties without launching the app.
   - Displays real-time pending duty count and top 2 focus tasks.
   - 1-tap launcher to jump directly into the full list.

3. **Watch Face Complication (`TaskComplicationService`):**
   - Shows live duty count directly on any supported Wear OS watch face slot.
   - Automatically refreshes every 5 minutes.

4. **Battery & Bandwidth Optimized:**
   - Communicates with `/api/wear/*` endpoints designed for ultra-low payload sizes.

---

## 📁 Architecture

```
wear/
├── build.gradle.kts          # Dependencies (Wear Compose, Tiles, Complications)
├── settings.gradle.kts       # Gradle project settings
├── AndroidManifest.xml       # Wear feature declaration, TileService, ComplicationService
├── src/main/java/com/hawkeyeip/taskflow/wear/
│   ├── MainActivity.kt               # Entry ComponentActivity
│   ├── presentation/
│   │   ├── TaskFlowWearApp.kt        # Rotary-optimized Compose list & voice input
│   │   └── theme/                    # Cyan, Purple, Green neon palette
│   ├── tile/
│   │   └── TaskFlowTileService.kt    # Wear OS Protolayout Tile
│   ├── complication/
│   │   └── TaskComplicationService.kt# Watch Face Complication provider
│   └── network/
│       ├── TaskFlowApiClient.kt      # OkHttp coroutine client
│       └── models/WearTask.kt        # Compact data transfer models
└── res/                              # Strings, colors, vector icons
```

---

## 🛠️ How to Build & Deploy

### Option A: Android Studio
1. Open Android Studio → **Open** → select `taskflow/wear`.
2. Select target device:
   - **Wear OS Emulator** (Round, API 30+ recommended).
   - **Physical Watch** (Google Pixel Watch, Samsung Galaxy Watch 4/5/6/7).
3. Click **Run ▶**.

### Option B: Command Line (ADB over Wi-Fi)
1. On your Pixel Watch / Galaxy Watch:
   - Go to **Settings** → **System** → **About** → tap **Build Number** 7 times.
   - Go to **Settings** → **Developer Options** → enable **ADB Debugging** and **Wireless Debugging**.
   - Note the IP address and port (e.g. `192.168.1.120:5555`).
2. Pair and connect from your Mac/PC:
   ```bash
   adb pair 192.168.1.120:<pairing-port>
   adb connect 192.168.1.120:<port>
   ```
3. Build and install:
   ```bash
   ./gradlew installDebug
   ```

---

## 🌐 Configuring Backend Connection

In [`TaskFlowApiClient.kt`](src/main/java/com/hawkeyeip/taskflow/wear/network/TaskFlowApiClient.kt):
- **For Android Emulator:** `http://10.0.2.2:3847` (points to host machine).
- **For Physical Watch on Wi-Fi:** `http://<your-computer-ip>:3847` (e.g. `http://192.168.1.50:3847`).
- **For Digital Bestie Local Relay:** `http://<your-computer-ip>:3847/api/wear`.
