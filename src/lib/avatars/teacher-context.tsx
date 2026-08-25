"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { MAYA, personaById, type InterviewerPersona } from "./personas";

const TeacherContext = createContext<InterviewerPersona>(MAYA);

/** Makes the onboarding selection available to every signed-in workspace page. */
export function WorkspaceTeacherProvider({
  teacherId,
  children
}: {
  teacherId: string | null;
  children: ReactNode;
}) {
  const teacher = useMemo(() => personaById(teacherId) ?? MAYA, [teacherId]);
  return <TeacherContext.Provider value={teacher}>{children}</TeacherContext.Provider>;
}

/** Maya remains the safe fallback for profiles created before teacher selection existed. */
export function useWorkspaceTeacher(): InterviewerPersona {
  return useContext(TeacherContext);
}
