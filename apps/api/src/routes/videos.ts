import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { videoController } from '../controllers/videoController';

export const videoRoutes = Router();

videoRoutes.get('/tracks', optionalAuthenticate, (req, res, next) => {
  void videoController.listTracks(req, res).catch(next);
});
videoRoutes.get('/topic', optionalAuthenticate, (req, res, next) => {
  void videoController.topicVideos(req, res).catch(next);
});
videoRoutes.get('/playlists/:playlistId', optionalAuthenticate, (req, res, next) => {
  void videoController.getPlaylist(req, res).catch(next);
});
videoRoutes.post('/playlists/:playlistId/complete', authenticate, (req, res, next) => {
  void videoController.completeVideo(req, res).catch(next);
});
