/**
 * ep001 — 媽祖生
 * 阿萬的白光照相館
 * 單一宮廟的媽祖誕辰慶典全記錄
 */

import { Episode } from "../../engine/shared/types";
import { subtitles } from "./ep001.subtitles";

export const ep001: Episode = {
  metadata: {
    title: '媽祖生',
    subtitle: '走進宮廟，看一場誕辰慶典的真實樣子',
    episodeTag: 'EP01 · 廟會紀錄',

    youtube: {
      title: '不解說，只記錄——用相機走過一場媽祖生',
      description: '廟會現場有一種氛圍，不在現場很難體會。\n\n供桌的光、香爐的煙、鞭炮的震動、陣頭的節奏——阿萬用攝影師的眼睛，把媽祖生那天的每一個當下定格下來。沒有過多解說，讓畫面說話。\n\n從清晨的儀式、中午的人潮，到廟口攤販的蒸氣和一碗平安麵。這就是台灣廟會的真實樣子。\n\n如果你喜歡這支影片，歡迎按讚訂閱，留言告訴我你最喜歡哪個畫面。\n\n章節：\n00:00 媽祖生\n00:05 現場定錨\n00:14 供桌\n00:23 捻香\n00:30 儀式\n00:37 人潮湧動\n00:42 鞭炮\n00:49 陣頭\n00:57 廟口美食\n01:06 平安麵\n01:13 人情側寫\n01:23 媽祖生',
      tags: ['媽祖生', '廟會紀錄', '台灣廟會', '紀錄片', '廟會攝影', '宮廟', '台灣文化', '阿萬的白光照相館', '台灣在地文化', '街頭攝影', '廟會美食', '陣頭'],
    },

    thumbnail: {
      variants: [
        {
          id: "v1",
          cardType: "thumbnail",
          label: "廟會現場",
          data: {
            title: "媽祖生",
            subtitle: "走進宮廟，看一場誕辰慶典",
            channelName: "阿萬的白光照相館",
            episodeTag: "EP01",
          },
        },
      ],
      primary: "v1",
    },
  },

  subtitles,

  steps: [
    // ── 1. Opening ──
    {
      id: 'intro',
      contentType: 'cover',
      data: {
        title: '媽祖生',
        subtitle: '農曆三月廿三',
        episodeTag: 'EP01 · 廟會紀錄',
        animation: 'matrix',
      },
      narration: '',
      durationInSeconds: 5,
    },

    // ── 2. 現場定錨 ──
    {
      id: 'location',
      contentType: 'image',
      data: {
        title: '現場定錨',
        src: '/episodes/Youtube-studio/ep001/images/temple-exterior.png',
        objectFit: 'cover',
      },
      narration: '這是阿萬今年在媽祖生那天，帶著相機走進的一間宮廟。不是什麼大廟，但一早香爐就已經滿了。',
      durationInSeconds: 10,
    },

    // ── 3. 主題一：準備與儀式 ──
    {
      id: 'prep-altar',
      contentType: 'image',
      data: {
        title: '供桌',
        src: '/episodes/Youtube-studio/ep001/images/prep-altar.png',
        objectFit: 'cover',
      },
      narration: '供桌上排得滿滿的。壽桃、紅龜粿、鮮花，每一樣都是信徒天還沒亮就準備好的。',
      durationInSeconds: 9,
    },
    {
      id: 'prep-incense',
      contentType: 'image',
      data: {
        title: '捻香',
        src: '/episodes/Youtube-studio/ep001/images/prep-incense.png',
        objectFit: 'cover',
      },
      narration: '捻香的人一個接一個。煙往上飄，整間廟像罩了一層薄薄的霧。',
      durationInSeconds: 7,
    },
    {
      id: 'prep-ceremony',
      contentType: 'image',
      data: {
        title: '儀式',
        src: '/episodes/Youtube-studio/ep001/images/prep-ceremony.png',
        objectFit: 'cover',
      },
      narration: '儀式開始的時候，鐘鼓聲一響，所有人都安靜下來。那種氛圍，不在現場很難體會。',
      durationInSeconds: 8,
    },

    // ── 4. 主題二：高潮時刻 ──
    {
      id: 'climax-crowd',
      contentType: 'image',
      data: {
        title: '人潮湧動',
        src: '/episodes/Youtube-studio/ep001/images/climax-crowd.png',
        objectFit: 'cover',
      },
      narration: '接近中午，人潮漸漸湧進來。廟埕幾乎沒有轉身的地方。',
      durationInSeconds: 6,
    },
    {
      id: 'climax-firecrackers',
      contentType: 'image',
      data: {
        title: '鞭炮',
        src: '/episodes/Youtube-studio/ep001/images/climax-firecrackers.png',
        objectFit: 'cover',
      },
      narration: '鞭炮聲一起，整條街都在震。不是吵，是一種——慶典該有的聲音。',
      durationInSeconds: 7,
    },
    {
      id: 'climax-performance',
      contentType: 'image',
      data: {
        title: '陣頭',
        src: '/episodes/Youtube-studio/ep001/images/climax-performance.png',
        objectFit: 'cover',
      },
      narration: '陣頭一來，氣氛又推到另一個高點。鑼鼓、腳步、喊聲——現場的節奏不需要解說。',
      durationInSeconds: 8,
    },

    // ── 5. 主題三：人情與日常 ──
    {
      id: 'humanity-food',
      contentType: 'image',
      data: {
        title: '廟口美食',
        src: '/episodes/Youtube-studio/ep001/images/humanity-food.png',
        objectFit: 'cover',
      },
      narration: '廟口這時候最熱鬧的不只是神明，還有攤販。蒸氣、油煙、人聲混在一起，就是廟會的氣味。',
      durationInSeconds: 10,
    },
    {
      id: 'humanity-meal',
      contentType: 'image',
      data: {
        title: '平安麵',
        src: '/episodes/Youtube-studio/ep001/images/humanity-meal.png',
        objectFit: 'cover',
      },
      narration: '廟方煮了一大鍋平安麵。不分彼此，路過的人都可以坐下來吃一碗。',
      durationInSeconds: 7,
    },
    {
      id: 'humanity-people',
      contentType: 'image',
      data: {
        title: '人情側寫',
        src: '/episodes/Youtube-studio/ep001/images/humanity-people.png',
        objectFit: 'cover',
      },
      narration: '媽祖生，不只是拜拜。它是阿公阿嬤一年一度出門的理由，是小孩第一次聞到鞭炮味的那天。',
      durationInSeconds: 11,
    },

    // ── 6. Closing ──
    {
      id: 'closing',
      contentType: 'summary',
      data: {
        title: '媽祖生',
        points: [
          '一間宮廟、一天的慶典記錄',
          '從供桌到攤販，從儀式到日常',
          '廟會文化，就是這樣一代一代傳下來的',
        ],
        ctaButtons: [
          { label: '訂閱阿萬，看更多廟會記錄' },
          { label: '留言告訴我你的媽祖生記憶' },
        ],
        showCta: true,
      },
      narration: '廟會的熱鬧會散，但畫面留下來了。我是阿萬，我們下次見。',
      durationInSeconds: 6,
    },
  ],
};
