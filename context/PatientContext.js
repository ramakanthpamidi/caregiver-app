// context/PatientContext.js
import { createContext, useCallback, useContext, useState } from 'react';

const PatientContext = createContext(null);

const INITIAL_PATIENT = {
  // Personal
  firstName:        '',
  lastName:         '',
  dateOfBirth:      '',
  gender:           '',
  mrn:              '',
  // Contact
  phone:            '',
  email:            '',
  address:          '',
  city:             '',
  state:            '',
  zipCode:          '',
  // Emergency
  emergencyContact: '',
  emergencyPhone:   '',
  relationship:     '',
  // Medical
  primaryDiagnosis: '',
  allergies:        '',
  currentMedications: '',
  bloodType:        '',
  insuranceId:      '',
  notes:            '',
};

export function PatientProvider({ children }) {
  const [patientInfo, setPatientInfo]       = useState(INITIAL_PATIENT);
  const [vitalsData, setVitalsData]         = useState({});
  const [vitalsQueue, setVitalsQueue]       = useState([]);   // ordered list of selected vital IDs
  const [completedVitals, setCompletedVitals] = useState([]); // IDs that have been saved

  const updatePatientInfo = useCallback((patch) => {
    setPatientInfo((prev) => ({ ...prev, ...patch }));
  }, []);

  /** Call this from the vitals-selection screen before starting collection */
  const initVitalsQueue = useCallback((orderedIds) => {
    setVitalsQueue(orderedIds);
    setCompletedVitals([]);
    setVitalsData({});
  }, []);

  /** Save a vital reading and mark as completed */
  const saveVitalReading = useCallback((vitalId, data) => {
    setVitalsData((prev) => ({
      ...prev,
      [vitalId]: { ...data, savedAt: new Date().toISOString() },
    }));
    setCompletedVitals((prev) =>
      prev.includes(vitalId) ? prev : [...prev, vitalId]
    );
  }, []);

  /** Returns the next vital ID after `currentId`, or null if done */
  const getNextVital = useCallback(
    (currentId) => {
      const idx = vitalsQueue.indexOf(currentId);
      if (idx === -1 || idx >= vitalsQueue.length - 1) return null;
      return vitalsQueue[idx + 1];
    },
    [vitalsQueue]
  );

  /** Progress percentage across the queue */
  const queueProgress = vitalsQueue.length
    ? Math.round((completedVitals.length / vitalsQueue.length) * 100)
    : 0;

  const resetAll = useCallback(() => {
    setPatientInfo(INITIAL_PATIENT);
    setVitalsData({});
    setVitalsQueue([]);
    setCompletedVitals([]);
  }, []);

  return (
    <PatientContext.Provider
      value={{
        patientInfo,
        updatePatientInfo,
        vitalsData,
        saveVitalReading,
        vitalsQueue,
        initVitalsQueue,
        completedVitals,
        getNextVital,
        queueProgress,
        resetAll,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error('usePatient must be used within <PatientProvider>');
  return ctx;
}