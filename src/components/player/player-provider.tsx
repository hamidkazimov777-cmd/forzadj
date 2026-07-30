"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { PlayerTrack } from "@/types/player";

/**
 * Глобальное состояние плеера DJ-зоны.
 * Один <audio> на приложение; живёт в layout — навигация не прерывает
 * воспроизведение. QueueService: очередь = видимая выборка каталога
 * в момент запуска трека.
 */

interface PlayerState {
  queue: PlayerTrack[];
  currentIndex: number;
  status: "idle" | "playing" | "paused";
  positionSec: number;
  volume: number;
}

type PlayerAction =
  | { type: "PLAY"; track: PlayerTrack; queue?: PlayerTrack[] }
  | { type: "TOGGLE" }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "TIME"; positionSec: number }
  | { type: "VOLUME"; volume: number }
  | { type: "ENDED" };

const initialState: PlayerState = {
  queue: [],
  currentIndex: -1,
  status: "idle",
  positionSec: 0,
  volume: 1,
};

function reducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "PLAY": {
      const queue = action.queue ?? state.queue;
      const idx = queue.findIndex(
        (t) => t.versionId === action.track.versionId,
      );
      return {
        ...state,
        queue: idx === -1 ? [action.track] : queue,
        currentIndex: idx === -1 ? 0 : idx,
        status: "playing",
        positionSec: 0,
      };
    }
    case "TOGGLE":
      if (state.currentIndex === -1) return state;
      return {
        ...state,
        status: state.status === "playing" ? "paused" : "playing",
      };
    case "NEXT":
    case "ENDED": {
      const next = state.currentIndex + 1;
      if (next >= state.queue.length) {
        return { ...state, status: "idle", positionSec: 0 };
      }
      return { ...state, currentIndex: next, status: "playing", positionSec: 0 };
    }
    case "PREV": {
      // Стандарт плееров: в начале трека — предыдущий, иначе — в начало.
      if (state.positionSec > 3 || state.currentIndex <= 0) {
        return { ...state, positionSec: 0 };
      }
      return {
        ...state,
        currentIndex: state.currentIndex - 1,
        status: "playing",
        positionSec: 0,
      };
    }
    case "TIME":
      return { ...state, positionSec: action.positionSec };
    case "VOLUME":
      return { ...state, volume: action.volume };
  }
}

interface PlayerApi extends PlayerState {
  current: PlayerTrack | null;
  play: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  /**
   * Живое время воспроизведения (audio.currentTime) для 60-FPS отрисовки
   * волны без React-перерисовок. Read-only; владение <audio> не передаётся.
   */
  getCurrentTime: () => number;
}

const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const current = state.queue[state.currentIndex] ?? null;

  // Единственный audio-элемент.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    const onTime = () => dispatch({ type: "TIME", positionSec: audio.currentTime });
    const onEnded = () => dispatch({ type: "ENDED" });
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, []);

  // Смена трека → новый src (только для программных переходов: авто-next
  // по окончании, MediaSession). Пользовательские действия ставят src и
  // зовут play() синхронно в обработчике — здесь src уже совпадает и мы
  // не перезагружаем поток.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    const wantSrc = `/api/stream/${current.versionId}`;
    if (!audio.src.endsWith(wantSrc)) {
      audio.src = wantSrc;
      if (state.status === "playing") void audio.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.versionId]);

  // Синхронизация паузы (play() для user-жестов вызывается в обработчиках).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (state.status !== "playing") audio.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = state.volume;
  }, [state.volume]);

  // MediaSession: наушники/клавиатура/системный плеер.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${current.title} (${current.versionType})`,
      artist: current.artistLine,
      album: "ForzaDJ",
    });
    navigator.mediaSession.setActionHandler("play", () => dispatch({ type: "TOGGLE" }));
    navigator.mediaSession.setActionHandler("pause", () => dispatch({ type: "TOGGLE" }));
    navigator.mediaSession.setActionHandler("nexttrack", () => dispatch({ type: "NEXT" }));
    navigator.mediaSession.setActionHandler("previoustrack", () => dispatch({ type: "PREV" }));
  }, [current]);

  const seek = useCallback((sec: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = sec;
      dispatch({ type: "TIME", positionSec: sec });
    }
  }, []);

  // Синхронный старт воспроизведения в рамках пользовательского жеста —
  // исключает отклонение autoplay-политикой (play() внутри onClick, не в эффекте).
  const playSrc = useCallback((versionId: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = `/api/stream/${versionId}`;
    void audio.play().catch(() => {});
  }, []);

  const api = useMemo<PlayerApi>(
    () => ({
      ...state,
      current,
      play: (track, queue) => {
        playSrc(track.versionId);
        dispatch({ type: "PLAY", track, queue });
      },
      toggle: () => {
        const audio = audioRef.current;
        if (audio && current) {
          if (audio.paused) void audio.play().catch(() => {});
          else audio.pause();
        }
        dispatch({ type: "TOGGLE" });
      },
      next: () => {
        const nextTrack = state.queue[state.currentIndex + 1];
        if (nextTrack) playSrc(nextTrack.versionId);
        dispatch({ type: "NEXT" });
      },
      prev: () => {
        // Совпадает с логикой reducer: в начале трека — предыдущий.
        if (state.positionSec <= 3 && state.currentIndex > 0) {
          playSrc(state.queue[state.currentIndex - 1].versionId);
        }
        dispatch({ type: "PREV" });
      },
      seek,
      setVolume: (v) => {
        // Применяем к <audio> сразу (без ожидания ре-рендера) — плавно и
        // предсказуемо; состояние держим для позиции ползунка.
        const clamped = Math.max(0, Math.min(1, v));
        if (audioRef.current) audioRef.current.volume = clamped;
        dispatch({ type: "VOLUME", volume: clamped });
      },
      getCurrentTime: () => audioRef.current?.currentTime ?? 0,
    }),
    [state, current, seek, playSrc],
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}
