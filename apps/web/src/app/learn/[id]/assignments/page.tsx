'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { getAssignmentsForCourse } from '@/data/assignments';
import { flattenAssignmentQuestions } from '@/types/assignment';
import styles from './assignment.module.css';

const COURSE_TITLES: Record<string, string> = {
  '1': 'Salaam DSA',
  '2': 'Salaam Node.js',
  '3': 'Salaam React',
  '4': 'JavaScript Fundamentals',
  '5': 'System Design',
  '6': 'Python for Beginners',
};

export default function CourseAssignmentsPage() {
  const params = useParams();
  const courseId = params.id as string;
  const assignments = getAssignmentsForCourse(courseId);
  const courseTitle = COURSE_TITLES[courseId] ?? 'Course';

  return (
    <DashboardShell mainClassName="min-h-0 overflow-y-auto p-0">
      <div className={styles.wrap}>
        <div className={styles.listWrap}>
          <div className={styles.listHero}>
            <Link href={`/learn/${courseId}`} className={styles.backLink}>
              ← Back to {courseTitle}
            </Link>
            <h1 className={styles.listTitle}>Assignments</h1>
            <p className={styles.listSub}>
              Complete graded assignments for this course. Your best attempt counts toward progress.
            </p>
          </div>

          {assignments.length === 0 ? (
            <div className={styles.empty}>No assignments published for this course yet.</div>
          ) : (
            <div className={styles.cardGrid}>
              {assignments.map((assignment) => {
                const qCount = flattenAssignmentQuestions(assignment).length;
                return (
                  <Link
                    key={assignment.id}
                    href={`/learn/${courseId}/assignments/${assignment.id}`}
                    className={styles.card}
                  >
                    <div className={styles.cardTop}>
                      <h2 className={styles.cardTitle}>{assignment.title}</h2>
                      <span className={`${styles.badge} ${styles.badgeMandatory}`}>Mandatory</span>
                    </div>
                    <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.92rem', lineHeight: 1.55 }}>
                      {assignment.description}
                    </p>
                    <div className={styles.cardMeta}>
                      <span className={styles.chip}>{assignment.total_marks} marks</span>
                      <span className={styles.chip}>{assignment.estimated_time}</span>
                      <span className={styles.chip}>{qCount} questions</span>
                      <span className={styles.chip}>{assignment.sections.length} sections</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
