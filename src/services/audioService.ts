import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

export interface PlaybackStatus {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  rate: number;
  didJustFinish: boolean;
}

let playerInstance: AudioPlayer | null = null;
let statusSubscription: any = null;
let statusUpdateCallback: ((status: PlaybackStatus) => void) | null = null;

export async function setupAudioSession(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });
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
  await unloadAudio();

  statusUpdateCallback = onStatusUpdate || null;

  try {
    const isRemote = uriOrFilePath.startsWith('http') || uriOrFilePath.startsWith('file://');
    const source = isRemote ? uriOrFilePath : { uri: uriOrFilePath };

    const player = createAudioPlayer(source);
    playerInstance = player;

    if (initialPositionMillis > 0) {
      await player.seekTo(initialPositionMillis / 1000);
    }

    statusSubscription = player.addListener('playbackStatusUpdate', (status: any) => {
      if (statusUpdateCallback && playerInstance) {
        statusUpdateCallback({
          isLoaded: playerInstance.isLoaded ?? true,
          isPlaying: playerInstance.playing ?? false,
          positionMillis: Math.round((playerInstance.currentTime || 0) * 1000),
          durationMillis: Math.round((playerInstance.duration || 1) * 1000),
          rate: playerInstance.playbackRate || 1.0,
          didJustFinish: status?.status === 'idle' && (playerInstance.currentTime >= ((playerInstance.duration || 1) - 0.5)),
        });
      }
    });

    if (onStatusUpdate) {
      onStatusUpdate({
        isLoaded: true,
        isPlaying: player.playing ?? false,
        positionMillis: Math.max(0, initialPositionMillis),
        durationMillis: Math.round((player.duration || 1140) * 1000),
        rate: player.playbackRate || 1.0,
        didJustFinish: false,
      });
    }
  } catch (error) {
    console.warn('Aviso al cargar audio con expo-audio:', error);
    if (onStatusUpdate) {
      onStatusUpdate({
        isLoaded: true,
        isPlaying: false,
        positionMillis: Math.max(0, initialPositionMillis),
        durationMillis: 1140000, // 19 minutes fallback
        rate: 1.0,
        didJustFinish: false,
      });
    }
  }
}

export async function playAudio(): Promise<void> {
  if (playerInstance) {
    try {
      playerInstance.play();
    } catch (e) {}
  }
}

export async function pauseAudio(): Promise<void> {
  if (playerInstance) {
    try {
      playerInstance.pause();
    } catch (e) {}
  }
}

export async function seekAudio(positionMillis: number): Promise<void> {
  if (playerInstance) {
    try {
      await playerInstance.seekTo(positionMillis / 1000);
    } catch (e) {}
  }
}

export async function setPlaybackRate(rate: number): Promise<void> {
  if (playerInstance) {
    try {
      playerInstance.playbackRate = rate;
    } catch (e) {}
  }
}

export async function unloadAudio(): Promise<void> {
  if (statusSubscription && typeof statusSubscription.remove === 'function') {
    try {
      statusSubscription.remove();
    } catch (e) {}
    statusSubscription = null;
  }
  if (playerInstance) {
    try {
      playerInstance.remove();
    } catch (e) {}
    playerInstance = null;
  }
}

