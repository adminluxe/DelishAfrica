import { useEffect, useState } from 'react';
import {
  cancelProductionRegistration,
  productionRegistrationAvailable,
  productionRegistrationSnapshot,
  startProductionRegistration,
  subscribeProductionRegistration,
} from '../auth/daProductionRegistration';
import type { EnrollmentApp } from '../auth/daEnrollmentContract';

export function useDaProductionRegistration(application: EnrollmentApp) {
  const [state, setState] = useState(productionRegistrationSnapshot);
  useEffect(() => subscribeProductionRegistration(
    () => setState(productionRegistrationSnapshot()),
  ), []);
  return {
    ...state,
    available: productionRegistrationAvailable(application),
    create: () => startProductionRegistration(application, 'register'),
    resume: () => startProductionRegistration(application, 'resume'),
    cancel: cancelProductionRegistration,
  };
}
