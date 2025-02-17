// Individual video IDs and playlist IDs for the mixed collection
const MIXED_COLLECTION = {
  videos: [
    // Individual video IDs
    // 'dQw4w9WgXcQ',  // Example video
    // 'jfKfPfyJRdk',  // Example lofi video
  ],
  playlists: [
    // Playlist IDs
    'OLAK5uy_nuIjhkZFBEnxmp3kyvsV2m-iHxUVbPjhE',  // https://www.youtube.com/playlist?list=OLAK5uy_nuIjhkZFBEnxmp3kyvsV2m-iHxUVbPjhE Neon Fangs
    'OLAK5uy_m8t72fbuwnVG_pbV6xLi3nfs38JYmt_0g',   // https://www.youtube.com/playlist?list=OLAK5uy_m8t72fbuwnVG_pbV6xLi3nfs38JYmt_0g Sleep Therapy 
    'OLAK5uy_nEVoe7Zz1LVU-cK_kxXS5BC0fly0Pvl3k',   // https://www.youtube.com/playlist?list=OLAK5uy_nEVoe7Zz1LVU-cK_kxXS5BC0fly0Pvl3k House of Glass 
    'OLAK5uy_kQLJTjYJuxTvILfdhT4_LJlsoUwUYSGl8',   // https://www.youtube.com/playlist?list=OLAK5uy_kQLJTjYJuxTvILfdhT4_LJlsoUwUYSGl8 Light
    'OLAK5uy_mR6tcHnR49kYnsf7vq-dORhfL4xNIoZxY',   // https://www.youtube.com/playlist?list=OLAK5uy_mR6tcHnR49kYnsf7vq-dORhfL4xNIoZxY Chill 
    'OLAK5uy_l4l8362TTRn9GPrcSwl4d__Ev7Ki7tImc',   // https://www.youtube.com/playlist?list=OLAK5uy_l4l8362TTRn9GPrcSwl4d__Ev7Ki7tImc Think
    'OLAK5uy_leqirmytI20aewLNoqCFouRotKjV2gq8M',   // https://www.youtube.com/playlist?list=OLAK5uy_leqirmytI20aewLNoqCFouRotKjV2gq8M Cherry Blossom 
  ]
};

const LOFI_COLLECTION = {
  videos: [
    'jfKfPfyJRdk',
  ],
  playlists: [
  ]
};

export const PRESET_PLAYLISTS = [
  {
    id: 'mixed',
    name: '100Devs Collection',
    description: 'Our very own @chrispnuggetr',
    type: 'mixed',
    content: MIXED_COLLECTION
  },
  {
    id: 'jfKfPfyJRdk',
    name: 'Lofi Hip Hop',
    description: 'Chill beats to study/relax to',
    type: 'mixed',
    content: LOFI_COLLECTION
  },
]; 