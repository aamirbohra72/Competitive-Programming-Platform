'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';

interface Course {
  id: string;
  title: string;
  description: string;
  language: string;
  validity: string;
  image?: string;
}

// Mock course data - in production, this would come from your API
const mockCourses: Course[] = [
  {
    id: '1',
    title: 'Salaam DSA',
    description: 'Master Data Structures and Algorithms with Salaam DSA hands-on coding, clear explanations, and real-world problem-solving.',
    language: 'English',
    validity: 'Lifetime',
  },
  {
    id: '2',
    title: 'Salaam Node.js',
    description: 'From basics to advanced concepts, gain experience in building applications.',
    language: 'English',
    validity: 'Lifetime',
  },
  {
    id: '3',
    title: 'Salaam React',
    description: 'Learn React from scratch and build modern web applications with hooks, context, and more.',
    language: 'English',
    validity: 'Lifetime',
  },
  {
    id: '4',
    title: 'JavaScript Fundamentals',
    description: 'Master the fundamentals of JavaScript programming language.',
    language: 'English',
    validity: 'Lifetime',
  },
  {
    id: '5',
    title: 'System Design',
    description: 'Learn to design scalable systems and ace your system design interviews.',
    language: 'English',
    validity: 'Lifetime',
  },
  {
    id: '6',
    title: 'Python for Beginners',
    description: 'Start your programming journey with Python. Learn syntax, data structures, and more.',
    language: 'English',
    validity: 'Lifetime',
  },
];

export default function GiftPage() {
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  const toggleCourseSelection = (courseId: string) => {
    const newSelected = new Set(selectedCourses);
    if (newSelected.has(courseId)) {
      newSelected.delete(courseId);
    } else {
      newSelected.add(courseId);
    }
    setSelectedCourses(newSelected);
  };

  const toggleCourseExpand = (courseId: string) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
    }
    setExpandedCourses(newExpanded);
  };

  const selectedCoursesList = mockCourses.filter((course) => selectedCourses.has(course.id));

  return (
    <DashboardShell mainClassName="min-h-0 overflow-y-auto p-4 sm:p-8">
          {/* Selected Gift(s) Section */}
          <div
            style={{
              background: 'var(--surface-panel)',
              border: '1px solid var(--border-theme)',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'var(--accent-theme)',
                marginBottom: '1rem',
              }}
            >
              Selected Gift(s)
            </h1>
            <div
              style={{
                height: '1px',
                background: 'var(--border-theme)',
                marginBottom: '1rem',
              }}
            />
            {selectedCourses.size === 0 ? (
              <>
                <p style={{ color: 'var(--text-theme)', marginBottom: '0.5rem' }}>No Gift Selected</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Please select the course(s) you&apos;d like to gift from the list below.
                </p>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedCoursesList.map((course) => (
                  <div
                    key={course.id}
                    style={{
                      background: 'var(--surface-raised)',
                      padding: '1rem',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {course.title}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{course.description}</p>
                    </div>
                    <button
                      onClick={() => toggleCourseSelection(course.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#ef4444';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: 'var(--surface-raised)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-theme)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Courses:</span>
                    <span style={{ fontWeight: '600' }}>{selectedCourses.size}</span>
                  </div>
                  <button
                    style={{
                      width: '100%',
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginTop: '1rem',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#16a34a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#22c55e';
                    }}
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Course Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {mockCourses.map((course) => {
              const isSelected = selectedCourses.has(course.id);
              const isExpanded = expandedCourses.has(course.id);

              return (
                <div
                  key={course.id}
                  style={{
                    background: 'var(--surface-raised)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    display: 'flex',
                    gap: '1.5rem',
                    flexWrap: 'wrap',
                    border: isSelected ? '2px solid var(--accent-theme)' : '1px solid var(--border-theme)',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Course Thumbnail */}
                  <div
                    style={{
                      width: '200px',
                      maxWidth: '100%',
                      height: '150px',
                      background: 'var(--accent-theme)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        textAlign: 'center',
                        padding: '1rem',
                      }}
                    >
                      {course.title.toUpperCase()}
                    </div>
                  </div>

                  {/* Course Details */}
                  <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h2
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: 'var(--text-theme)',
                        margin: 0,
                      }}
                    >
                      {course.title}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                      {course.description}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        <span>Course Validity :</span>
                        <span style={{ color: 'var(--text-theme)', fontWeight: '500' }}>{course.validity}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        <span>🌐</span>
                        <span>{course.language}</span>
                      </div>
                      <div
                        style={{
                          marginTop: '0.5rem',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                        onClick={() => toggleCourseExpand(course.id)}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'var(--text-muted)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span>Course Related Add-ons</span>
                          <span style={{ fontSize: '0.75rem' }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                        {isExpanded && (
                          <div
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.75rem',
                              background: 'var(--surface-panel)',
                              borderRadius: '6px',
                              color: 'var(--text-muted)',
                              fontSize: '0.875rem',
                            }}
                          >
                            Additional resources and materials will be included with this course.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      paddingTop: '0.25rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCourseSelection(course.id)}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        accentColor: 'var(--accent-theme)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* WhatsApp Button */}
          <div
            style={{
              position: 'fixed',
              bottom: '2rem',
              right: '2rem',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              zIndex: 1000,
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onClick={() => {
              window.open('https://wa.me/1234567890', '_blank');
            }}
          >
            <span style={{ fontSize: '2rem' }}>💬</span>
          </div>
    </DashboardShell>
  );
}

