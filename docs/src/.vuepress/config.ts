import { defaultTheme } from "@vuepress/theme-default";
import { searchPlugin } from "@vuepress/plugin-search";
import { nprogressPlugin } from "@vuepress/plugin-nprogress";
import { pwaPlugin } from "@vuepress/plugin-pwa";
import { seoPlugin } from "@vuepress/plugin-seo";
import { defineUserConfig } from "vuepress";
import { viteBundler } from '@vuepress/bundler-vite'

export default defineUserConfig({
  
  base: "/learning-android/",
  port: 3000,

  head: [
    ["link", { rel: "icon", href: "/learning-android/favicon.ico" }],
    [
      "link",
      { rel: "manifest", href: "/learning-android/manifest.webmanifest" },
    ],
    ["meta", { name: "theme-color", content: "#3DDC84" }],
  ],

  theme: defaultTheme({
        logo: 'logo_worldline.png',
        repo: 'https://github.com/gbrah/learning-android',
        repoLabel: 'Contribute!',

        sidebar: [
          { text: 'Home', link: '/' },
          "/overview/",
          //"/configure/",
          "/ui/",
          "/network/",
          "/navigation/",
          "/database/",
        ], 
  }),

  bundler: viteBundler({
    viteOptions: {},
    vuePluginOptions: {},
  }),

  plugins: [
    seoPlugin({
      hostname: "https://gbrah.github.io/learning-android",
    }),
  ],
});
