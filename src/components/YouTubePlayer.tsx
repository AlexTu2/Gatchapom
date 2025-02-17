// import React, { useEffect, useState, useCallback } from 'react';
// import { Label } from './ui/label';
// import { Card, CardContent } from './ui/card';
// import { useTimer } from '@/lib/context/timer';
// import { useAudio } from '@/lib/context/audio';
// import { Checkbox } from '@/components/ui/checkbox';

// // Add this CSS to your global styles or component
// const styles = `
// .yt-lite {
//   background-color: #000;
//   position: relative;
//   display: block;
//   contain: content;
//   background-position: center center;
//   background-size: cover;
//   cursor: pointer;
// }

// .yt-lite::before {
//   content: '';
//   display: block;
//   position: absolute;
//   top: 0;
//   background-position: top;
//   background-repeat: repeat-x;
//   height: 60px;
//   padding-bottom: 50px;
//   width: 100%;
//   transition: all 0.2s cubic-bezier(0, 0, 0.2, 1);
// }

// .yt-lite::after {
//   content: "";
//   display: block;
//   padding-bottom: calc(100% / (16 / 9));
// }

// .yt-lite > iframe {
//   width: 100%;
//   height: 100%;
//   position: absolute;
//   top: 0;
//   left: 0;
// }

// .yt-lite > .lty-playbtn {
//   width: 70px;
//   height: 46px;
//   background-color: #212121;
//   z-index: 1;
//   opacity: 0.8;
//   border-radius: 14%;
//   transition: all 0.2s cubic-bezier(0, 0, 0.2, 1);
// }

// .yt-lite:hover > .lty-playbtn {
//   background-color: red;
//   opacity: 1;
// }

// .yt-lite > .lty-playbtn:before {
//   content: '';
//   border-style: solid;
//   border-width: 11px 0 11px 19px;
//   border-color: transparent transparent transparent #fff;
// }

// .yt-lite > .lty-playbtn,
// .yt-lite > .lty-playbtn:before {
//   position: absolute;
//   top: 50%;
//   left: 50%;
//   transform: translate3d(-50%, -50%, 0);
// }

// .yt-lite.lyt-activated {
//   cursor: unset;
// }

// .yt-lite.lyt-activated::before,
// .yt-lite.lyt-activated > .lty-playbtn {
//   opacity: 0;
//   pointer-events: none;
// }
// `;

// interface YouTubeIframeAPI {
//   pauseVideo: () => void;
//   playVideo: () => void;
//   setVolume: (volume: number) => void;
//   getPlayerState: () => number;
//   addEventListener: (event: string, handler: () => void) => void;
//   removeEventListener: (event: string, handler: () => void) => void;
// }

// interface PlayModes {
//   work: boolean;
//   shortBreak: boolean;
//   longBreak: boolean;
// }
// export function YouTubePlayer() {
//   const timer = useTimer();
//   const { volume } = useAudio();
//   const [isSync, setIsSync] = useState(true);
//   const [playModes, setPlayModes] = useState<PlayModes>({
//     work: true,
//     shortBreak: true,
//     longBreak: true
//   });
//   const [iframeApi, setIframeApi] = useState<YouTubeIframeAPI | null>(null);
//   const [isPlayerReady, setIsPlayerReady] = useState(false);

//   // Add styles to document
//   useEffect(() => {
//     const styleSheet = document.createElement("style");
//     styleSheet.textContent = styles;
//     document.head.appendChild(styleSheet);
//     return () => {
//       document.head.removeChild(styleSheet);
//     };
//   }, []);

//   const syncWithTimer = useCallback(() => {
//     if (!iframeApi || !isPlayerReady || !isSync) return;

//     const shouldPlay = playModes[timer.mode as keyof PlayModes];
    
//     try {
//       if (timer.status === 'paused' || !shouldPlay) {
//         const playerState = iframeApi.getPlayerState();
//         // Only pause if currently playing (1 = playing)
//         if (playerState === 1) {
//           iframeApi.pauseVideo();
//         }
//       } else if (timer.status === 'running' && shouldPlay) {
//         const playerState = iframeApi.getPlayerState();
//         // Only play if currently paused (2 = paused)
//         if (playerState === 2) {
//           iframeApi.playVideo();
//         }
//       }
//     } catch (error) {
//       console.error('Error syncing with timer:', error);
//     }
//   }, [timer.status, timer.mode, isSync, playModes, iframeApi, isPlayerReady]);

//   // Handle timer state changes
//   useEffect(() => {
//     syncWithTimer();
//   }, [syncWithTimer]);

//   // Handle volume changes
//   useEffect(() => {
//     if (iframeApi && isPlayerReady) {
//       try {
//         iframeApi.setVolume(volume);
//       } catch (error) {
//         console.error('Error setting volume:', error);
//       }
//     }
//   }, [volume, iframeApi, isPlayerReady]);

//   const onIframeAdded = (iframe: HTMLIFrameElement) => {
//     // Wait for iframe to be ready
//     const checkReady = setInterval(() => {
//       try {
//         // @ts-expect-error - YouTube API types are not fully typed
//         const api: YouTubeIframeAPI = iframe.contentWindow;
//         if (api && typeof api.playVideo === 'function') {
//           setIframeApi(api);
//           setIsPlayerReady(true);
//           api.setVolume(volume);
//           clearInterval(checkReady);
//         }
//       } catch (error) {
//         console.error('Error checking player ready:', error);
//       }
//     }, 100);

//     // Clear interval after 10 seconds to prevent memory leak
//     setTimeout(() => {
//       clearInterval(checkReady);
//     }, 10000);
//   };

//   // Handle sync toggle
//   const handleSyncToggle = (checked: boolean) => {
//     setIsSync(checked);
//     if (checked) {
//       // Immediately sync with current timer state
//       syncWithTimer();
//     }
//   };

//   return (
//     <Card className="mt-4">
//       <CardContent className="space-y-4">
//         <div className="rounded-lg overflow-hidden aspect-video">
//           <iframe
//             id="jfKfPfyJRdk"
//             title="Lofi Music Stream"
//             onLoad={(e) => onIframeAdded(e.currentTarget)}
//             src={`https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&enablejsapi=1&controls=1&origin=http://localhost:5173`}
//             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
//             allowFullScreen
//             width="100%"
//             height="100%"
//             style={{ border: 0 }}
//           />
//         </div>
        
//         <div className="flex flex-col gap-4">
//           <div className="flex items-center gap-2">
//             <Checkbox 
//               id="sync-timer"
//               checked={isSync}
//               onCheckedChange={handleSyncToggle}
//             />
//             <Label htmlFor="sync-timer">Sync with timer</Label>
//           </div>

//           <div className="space-y-2">
//             <Label>Play music during:</Label>
//             <div className="flex gap-4">
//               {(Object.keys(playModes) as Array<keyof PlayModes>).map((mode) => (
//                 <div key={mode} className="flex items-center gap-2">
//                   <Checkbox
//                     id={`play-${mode}`}
//                     checked={playModes[mode]}
//                     onCheckedChange={(checked: boolean) => {
//                       setPlayModes(prev => ({ ...prev, [mode]: checked }));
//                       // Sync immediately when changing play modes
//                       if (isSync) {
//                         setTimeout(syncWithTimer, 0);
//                       }
//                     }}
//                   />
//                   <Label htmlFor={`play-${mode}`}>
//                     {mode === 'work' ? 'Work' : 
//                      mode === 'shortBreak' ? 'Short Break' : 'Long Break'}
//                   </Label>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   );
// } 