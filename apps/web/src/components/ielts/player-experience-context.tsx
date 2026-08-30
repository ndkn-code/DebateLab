"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { IeltsPlayerExperience } from "./player-experience";

const IeltsPlayerExperienceContext =
  createContext<IeltsPlayerExperience>("exam_simulation");

export function IeltsPlayerExperienceProvider({
  value,
  children,
}: {
  value: IeltsPlayerExperience;
  children: ReactNode;
}) {
  return (
    <IeltsPlayerExperienceContext.Provider value={value}>
      {children}
    </IeltsPlayerExperienceContext.Provider>
  );
}

export function useIeltsPlayerExperience(): IeltsPlayerExperience {
  return useContext(IeltsPlayerExperienceContext);
}
