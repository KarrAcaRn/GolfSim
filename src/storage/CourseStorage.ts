import { CourseData } from '../models/CourseData';

const STORAGE_KEY_PREFIX = 'golfsim_course_';

export class CourseStorage {
  static save(course: CourseData): void {
    const key = STORAGE_KEY_PREFIX + this.sanitizeName(course.name);
    course.metadata.updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(course));
  }

  static load(name: string): CourseData | null {
    const key = STORAGE_KEY_PREFIX + this.sanitizeName(name);
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as CourseData;
  }

  static listSavedCourses(): string[] {
    const courses: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        courses.push(key.replace(STORAGE_KEY_PREFIX, ''));
      }
    }
    return courses;
  }

  static delete(name: string): void {
    const key = STORAGE_KEY_PREFIX + this.sanitizeName(name);
    localStorage.removeItem(key);
  }

  private static sanitizeName(name: string): string {
    return name.replace(/\s+/g, '_').toLowerCase();
  }
}
