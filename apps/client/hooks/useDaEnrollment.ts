import { useEffect, useState } from 'react';
import { enrollmentSnapshot, subscribeEnrollment, enrollmentRuntime, startEnrollment, cancelEnrollment } from '../auth/daEnrollmentFlow';
import type { EnrollmentApp } from '../auth/daEnrollmentContract';
export function useDaEnrollment(application: EnrollmentApp) {
  const [state, setState] = useState(enrollmentSnapshot);
  useEffect(() => subscribeEnrollment(() => setState(enrollmentSnapshot())), []);
  return { ...state, available: Boolean(enrollmentRuntime(application)),
    create: () => startEnrollment(application, 'register'),
    resume: () => startEnrollment(application, 'resume'), cancel: cancelEnrollment };
}
