import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface ActivityLog {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  details: string;
  projectId?: string;
  projectName?: string;
  metadata?: any;
  timestamp: any;
}

export const logActivity = async (
  action: string,
  details: string,
  projectId?: string,
  projectName?: string,
  metadata?: any
) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn("Attempted to log activity without an authenticated user.");
      return;
    }

    const logEntry = {
      userId: user.uid,
      userName: user.displayName || 'Unknown User',
      userEmail: user.email || 'No Email',
      action,
      details,
      projectId: projectId || null,
      projectName: projectName || null,
      metadata: metadata || null,
      timestamp: serverTimestamp(),
    };

    await addDoc(collection(db, 'activity_logs'), logEntry);
  } catch (error) {
    console.error("Failed to log activity:", error);
    // We intentionally don't throw or show toast here so it doesn't interrupt the main UX
  }
};
