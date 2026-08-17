import { Router } from 'express';
import { leaderboardController } from '../controllers/leaderboardController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

export const leaderboardRoutes = Router();

leaderboardRoutes.get('/overview', optionalAuthenticate, leaderboardController.getOverview);
leaderboardRoutes.get('/profile/:username', leaderboardController.getProfileByUsername);

leaderboardRoutes.use(authenticate);

leaderboardRoutes.get('/contest/:contestId', leaderboardController.getContestLeaderboard);
leaderboardRoutes.get('/contest/:contestId/user/:userId', leaderboardController.getUserRank);


