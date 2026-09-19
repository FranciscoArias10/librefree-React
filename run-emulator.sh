#!/usr/bin/env bash
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
export DISPLAY="${DISPLAY:-:0}"

AVD_NAME="librefree_emu"

if adb devices | grep -q "emulator"; then
    echo "📱 El emulador Android ya está activo en adb."
    adb devices
    exit 0
fi

echo "🚀 Iniciando emulador Android '$AVD_NAME'..."
nohup emulator -avd "$AVD_NAME" -gpu auto -no-snapshot -netdelay none -netspeed full > /tmp/emulator.log 2>&1 &
disown

echo "⏳ Conectando con ADB..."
adb wait-for-device
command -v i3-msg >/dev/null 2>&1 && i3-msg '[class="Emulator"] floating enable' >/dev/null 2>&1
echo "✅ Emulador conectado en ADB!"
adb devices
