import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AppError } from '../lib/errors';
import { isPremiumCourseProduct, userHasEnrollment } from '../services/productCatalog';

/**
 * For premium catalog courses, require a paid Enrollment row.
 * Free courses (and unknown IDs that are not in the paid catalog) pass through.
 */
export function requireCourseEnrollment(paramName: 'courseId' | 'id' = 'courseId') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const courseId = String(req.params[paramName] || '');
      if (!courseId || !isPremiumCourseProduct(courseId)) {
        next();
        return;
      }
      if (!req.user?.userId) {
        throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
      }
      const enrolled = await userHasEnrollment(req.user.userId, courseId);
      if (!enrolled) {
        throw new AppError('ENROLLMENT_REQUIRED', 402, 'Enrollment required for this course');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
