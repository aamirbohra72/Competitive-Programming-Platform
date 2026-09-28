export type VideoPlaylistProgress = {
  percent: number;
  completedCount: number;
  lastVideoId: string | null;
  lastVideoTitle: string | null;
  lastActivityAt: string;
};

export type VideoPlaylist = {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnail: string | null;
  itemCount: number;
  progress?: VideoPlaylistProgress | null;
};

export type VideoTrack = {
  slug: string;
  title: string;
  instructor: string;
  description: string;
  playlists: VideoPlaylist[];
};

export type VideoTracksResponse = {
  tracks: VideoTrack[];
  continueWatching: {
    playlistId: string;
    playlistTitle: string | null;
    lastVideoId: string | null;
    lastVideoTitle: string | null;
    percent: number;
  } | null;
};

export type PlaylistVideo = {
  videoId: string;
  position: number;
  title: string;
  description: string;
  thumbnail: string | null;
  durationSeconds: number | null;
};

export type PlaylistDetailResponse = {
  playlist: VideoPlaylist | null;
  track: string | null;
  videos: PlaylistVideo[];
  completedVideoIds: string[];
  nextVideoId: string | null;
};
