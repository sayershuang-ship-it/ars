/**
 * 阿萬的白光照相館 — series configuration.
 */

import { DEFAULT_VTUBER_CONFIG, DEFAULT_SUBTITLE_CONFIG } from '../../engine/shared/defaults';
import type { StreamingLayoutConfig } from '../../engine/layouts/StreamingLayout';
import type { SeriesConfig } from '../../engine/shared/types';

const fontFamily = '"Noto Sans TC", sans-serif';

// ── Theme: 暖色廟會風 ──
const theme = {
  colors: {
    primary: "#c44536",
    secondary: "#8b3a2c",
    accent: "#e8a850",
    surfaceLight: "#f5efed",
    surfaceDark: "#271c18",
    surfaceCard: "#352420",
    surfaceCardHeader: "#271c18",
    surfaceCode: "#1e1e1e",
    surfaceOverlay: "rgba(39, 28, 24, 0.85)",
    onLight: "#3d302a",
    onDark: "#f5efed",
    onCard: "#ede0d6",
    onCardMuted: "rgba(237, 224, 214, 0.6)",
    onPrimary: "#ffffff",
    onCode: "#d4d4d4",
    positive: "#6b8f71",
    negative: "#b85c3c",
    info: "#5b7e9e",
    warning: "#c49a5c",
    highlight: "#b8684a",
    gradientDark: "linear-gradient(135deg, #271c18 0%, #352420 50%, #1e1814 100%)",
    gradientGold: "linear-gradient(135deg, #c44536, #e8a850)",
    gradientShimmer: "linear-gradient(90deg, #c44536, #e8a850, #d4704e, #c44536)",
    border: "#713a2a",
    borderLight: "rgba(255, 255, 255, 0.1)",
    shadow: "rgba(196, 69, 54, 0.2)",
    shadowDark: "rgba(0, 0, 0, 0.4)",
    bgLight: "#f5efed",
    bgDark: "#271c18",
    textMain: "#3d302a",
    textInverse: "#ffffff",
    textMuted: "#9ca3af",
    textLight: "#e2e8f0",
    cardBg: "#352420",
    cardHeaderBg: "#271c18",
    codeBackground: "#1e1e1e",
  },
  fonts: {
    main: fontFamily,
    code: '"JetBrains Mono", "Fira Code", monospace',
    fallback: '"Inter", system-ui, sans-serif',
  },
};

// ── VTuber (不使用，純畫面＋字幕風格) ──
const vtuber = {
  ...DEFAULT_VTUBER_CONFIG,
  enabled: false,
  closedImg: 'episodes/Youtube-studio/shared/vtuber/ginseng_closed.png',
  openImg: 'episodes/Youtube-studio/shared/vtuber/ginseng_open.png',
} as const;

// ── Export ──
export const SERIES_CONFIG: SeriesConfig = {
  shell: {
    layout: 'streaming',
    config: {
      vtuber,
      subtitle: DEFAULT_SUBTITLE_CONFIG,
    } satisfies StreamingLayoutConfig,
    theme,
  },
  episodeDefaults: {
    width: 1920,
    height: 1080,
    fps: 30,
    channelName: '阿萬的白光照相館',
    brandTag: 'EP',
  },
  speech: {
    enabled: false,
    provider: 'minimax',
    reviewRequiresNativeTiming: true,
    defaults: {
      model: 'speech-02-hd',
      voice: 'female-shaonv',
      rate: 1,
      pitch: 0,
      volume: 1,
      format: 'mp3',
      providerOptions: {
        minimax: {
          subtitleEnable: true,
          pronunciationDictPath: 'cli/pronunciation_dict.yaml',
          apiBase: 'https://api-uw.minimax.io/v1/t2a_v2',
        },
      },
    },
  },
};
