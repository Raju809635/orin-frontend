import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { normalizeLearnerStage, type LearnerStage } from "@/lib/learnerExperience";
import { useAuth } from "@/context/AuthContext";

type LearnerContextValue = {
  learnerStage: LearnerStage;
  institutionName: string;
  className: string;
  institutionType: string;
  loading: boolean;
  refresh: () => Promise<void>;
};

const LearnerContext = createContext<LearnerContextValue | undefined>(undefined);

const defaultValue: LearnerContextValue = {
  learnerStage: "after12",
  institutionName: "",
  className: "",
  institutionType: "",
  loading: false,
  refresh: async () => {}
};

export function LearnerProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [learnerStage, setLearnerStage] = useState<LearnerStage>("after12");
  const [institutionName, setInstitutionName] = useState("");
  const [className, setClassName] = useState("");
  const [institutionType, setInstitutionType] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || user?.role !== "student") {
      setLearnerStage("after12");
      setInstitutionName("");
      setClassName("");
      setInstitutionType("");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.get("/api/profiles/student/me");
      const profile = data?.profile || {};
      setLearnerStage(normalizeLearnerStage(profile?.learnerStage));
      setInstitutionName(String(profile?.institutionName || profile?.collegeName || "").trim());
      setClassName(String(profile?.className || "").trim());
      setInstitutionType(String(profile?.institutionType || "").trim());
    } catch {
      setLearnerStage("after12");
      setInstitutionName("");
      setClassName("");
      setInstitutionType("");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      learnerStage,
      institutionName,
      className,
      institutionType,
      loading,
      refresh
    }),
    [className, institutionName, institutionType, learnerStage, loading, refresh]
  );

  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>;
}

export function useLearner() {
  const context = useContext(LearnerContext);
  return context || defaultValue;
}
