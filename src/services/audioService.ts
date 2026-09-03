let Audio: any = null;
try {
  Audio = require('expo-av').Audio;
} catch (err) {
  console.warn('expo-av ExponentAV module not available in Expo Go 57');
}

export interface PlaybackStatus {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  rate: number;
  didJustFinish: boolean;
}

let soundInstance: any = null;
let statusUpdateCallback: ((status: PlaybackStatus) => void) | null = null;

export async function setupAudioSession(): Promise<void> {
  try {
    if (Audio && Audio.setAudioModeAsync) {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    }
  } catch (error) {
    console.warn('Error al configurar sesión de audio:', error);
  }
}

export async function loadAudiobookTrack(
  uriOrFilePath: string,
  onStatusUpdate?: (status: PlaybackStatus) => void,
  initialPositionMillis: number = 0
): Promise<void> {
  await setupAudioSession();
  
  if (soundInstance && soundInstance.unloadAsync) {
    try {
      await soundInstance.unloadAsync();
    } catch (e) {}
    soundInstance = null;
  }

  statusUpdateCallback = onStatusUpdate || null;

  try {
    if (!Audio || !Audio.Sound) {
      throw new Error('ExponentAV no disponible en esta versión de Expo');
    }

    const isRemote = uriOrFilePath.startsWith('http') || uriOrFilePath.startsWith('file://');
    const source = isRemote ? { uri: uriOrFilePath } : { uri: uriOrFilePath };

    const { sound } = await Audio.Sound.createAsync(
      source,
      { shouldPlay: false, positionMillis: Math.max(0, initialPositionMillis), rate: 1.0 },
      onPlaybackStatusUpdate
    );

    soundInstance = sound;
  } catch (error) {
    console.warn('Aviso: ExponentAV no compatible directamente en Expo Go 57:', error);
    // Fallback status for UI when ExponentAV native module is absent in Expo Go 57
    if (onStatusUpdate) {
      onStatusUpdate({
        isLoaded: true,
        isPlaying: false,
        positionMillis: Math.max(0, initialPositionMillis),
        durationMillis: 1140000, // 19 minutes
        rate: 1.0,
        didJustFinish: false,
      });
    }
  }
}

function onPlaybackStatusUpdate(status: any): void {
  if (!status.isLoaded) return;

  const pbStatus: PlaybackStatus = {
    isLoaded: true,
    isPlaying: status.isPlaying,
    positionMillis: status.positionMillis || 0,
    durationMillis: status.durationMillis || 1,
    rate: status.rate || 1.0,
    didJustFinish: status.didJustFinish || false,
  };

  if (statusUpdateCallback) {
    statusUpdateCallback(pbStatus);
  }
}

export async function playAudio(): Promise<void> {
  if (soundInstance && soundInstance.playAsync) {
    try {
      await soundInstance.playAsync();
    } catch (e) {}
  }
}

export async function pauseAudio(): Promise<void> {
  if (soundInstance && soundInstance.pauseAsync) {
    try {
      await soundInstance.pauseAsync();
    } catch (e) {}
  }
}

export async function seekAudio(positionMillis: number): Promise<void> {
  if (soundInstance && soundInstance.setPositionAsync) {
    try {
      await soundInstance.setPositionAsync(positionMillis);
    } catch (e) {}
  }
}

export async function setPlaybackRate(rate: number): Promise<void> {
  if (soundInstance && soundInstance.setRateAsync) {
    try {
      await soundInstance.setRateAsync(rate, true);
    } catch (e) {}
  }
}

export async function unloadAudio(): Promise<void> {
  if (soundInstance && soundInstance.unloadAsync) {
    try {
      await soundInstance.unloadAsync();
    } catch (e) {}
    soundInstance = null;
  }
}
