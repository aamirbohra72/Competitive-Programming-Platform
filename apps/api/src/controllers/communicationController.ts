import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import {
  coachMeetingResponse,
  generateMeetingScenario,
  listMeetingTypes,
  MEETING_TYPES,
} from '../services/communicationLlmService';

const scenarioBodySchema = z.object({
  meetingType: z.enum(MEETING_TYPES),
});

const coachBodySchema = z.object({
  meetingType: z.enum(MEETING_TYPES),
  scenario: z.unknown(),
  userResponse: z.string().min(20).max(4000),
});

export const communicationController = {
  async listTypes(_req: AuthRequest, res: Response): Promise<void> {
    res.json({
      types: listMeetingTypes(),
      source: 'catalog',
    });
  },

  async createScenario(req: AuthRequest, res: Response): Promise<void> {
    const { meetingType } = scenarioBodySchema.parse(req.body);
    const scenario = await generateMeetingScenario(meetingType);
    res.json(scenario);
  },

  async coach(req: AuthRequest, res: Response): Promise<void> {
    const body = coachBodySchema.parse(req.body);
    const result = await coachMeetingResponse(body);
    res.json(result);
  },
};
