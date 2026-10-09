/* eslint-disable @typescript-eslint/no-var-requires */
// import Vue from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'


const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/home',
      name: 'Home',
      component: require('./views/Home/index.vue').default,
      meta: {
        name: 'Home',
      },
    },
    {
      path: '/dailyMix',
      name: 'DailyMix',
      component: require('./views/DailyMix/index.vue').default,
      meta: {
        name: 'DailyMix',
      },
    },
    {
      path: '/artist',
      name: 'Artist',
      component: require('./views/Artist/index.vue').default,
      meta: {
        name: 'Artist',
      },
    },
    {
      path: '/album',
      name: 'Album',
      component: require('./views/Album/index.vue').default,
      meta: {
        name: 'Album',
      },
    },
    {
      path: '/search',
      name: 'Search',
      component: require('./views/Search/index.vue').default,
      meta: {
        name: 'Search',
      },
    },
    {
      path: '/songList/list',
      name: 'SongList',
      component: require('./views/songList/List/index.vue').default,
      meta: {
        name: 'SongList',
      },
    },
    {
      path: '/songList/detail',
      name: 'SongListDetail',
      component: require('./views/songList/Detail/index.vue').default,
      meta: {
        name: 'SongList',
      },
    },
    {
      path: '/leaderboard',
      name: 'Leaderboard',
      component: require('./views/Leaderboard/index.vue').default,
      meta: {
        name: 'Leaderboard',
      },
    },
    {
      path: '/list',
      name: 'List',
      component: require('./views/List/index.vue').default,
      meta: {
        name: 'List',
      },
    },
    {
      path: '/library',
      name: 'Library',
      component: require('./views/Library/index.vue').default,
      meta: {
        name: 'Library',
      },
    },
    {
      path: '/import',
      name: 'Import',
      component: require('./views/Import/index.vue').default,
      meta: {
        name: 'Import',
      },
    },
    {
      path: '/stats',
      name: 'Stats',
      component: require('./views/Stats/index.vue').default,
      meta: {
        name: 'Stats',
      },
    },
    {
      path: '/download',
      name: 'Download',
      component: require('./views/Download/Root.vue').default,
      meta: {
        name: 'Download',
      },
    },
    {
      path: '/setting',
      name: 'Setting',
      component: require('./views/Setting/index.vue').default,
      meta: {
        name: 'Setting',
      },
    },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
  ],
  linkActiveClass: 'active-link',
  linkExactActiveClass: 'exact-active-link',
})


export default router
