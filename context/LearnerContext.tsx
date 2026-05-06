import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";
import { LEARNER_STAGE_CACHE_KEY, normalizeLearnerStage, type LearnerStage } from "@/lib/learnerExperience";
import { useAuth } from "@/context/AuthContext";

type LearnerContextValue = {
  learnerStage: LearnerStage;
  institutionName: string;
  className: string;
  institutionType: string;
  loading: boolean;
  ready: boolean;
  refresh: () => Promise<void>;
};

const LearnerContext = createContext<LearnerContextValue | undefined>(undefined);

const defaultValue: LearnerContextValue = {
  learnerStage: "after12",
  institutionName: "",
  className: "",
  institutionType: "",
  loading: false,
  ready: true,
  refresh: async () => {}
};

export function LearnerProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [learnerStage, setLearnerStage] = useState<LearnerStage>("after12");
  const [institutionName, setInstitutionName] = useState("");
  const [className, setClassName] = useState("");
  const [institutionType, setInstitutionType] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || user?.role !== "student") {
      setLearnerStage("after12");
      setInstitutionName("");
      setClassName("");
      setInstitutionType("");
      setLoading(false);
      setHasLoadedProfile(true);
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.get("/api/profiles/student/me");
      const profile = data?.profile || {};
      const nextStage = normalizeLearnerStage(profile?.learnerStage);
      setLearnerStage(nextStage);
      setInstitutionName(String(profile?.institutionName || profile?.collegeName || "").trim());
      setClassName(String(profile?.className || "").trim());
      setInstitutionType(String(profile?.institutionType || "").trim());
      await AsyncStorage.setItem(LEARNER_STAGE_CACHE_KEY, nextStage);
    } catch {
      setLearnerStage("after12");
      setInstitutionName("");
      setClassName("");
      setInstitutionType("");
    } finally {
      setHasLoadedProfile(true);
      setLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    let active = true;
    async function hydrateCachedStage() {
      if (!isAuthenticated || user?.role !== "student") return;
      try {
        const cached = await AsyncStorage.getItem(LEARNER_STAGE_CACHE_KEY);
        if (active && cached) {
          setLearnerStage(normalizeLearnerStage(cached));
        }
      } catch {}
    }
    void hydrateCachedStage();
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    setHasLoadedProfile(false);
    void refresh();
  }, [refresh]);

  const ready = !isAuthenticated || user?.role !== "student" || hasLoadedProfile;

  const value = useMemo(
    () => ({
      learnerStage,
      institutionName,
      className,
      institutionType,
      loading: loading || !ready,
      ready,
      refresh
    }),
    [className, institutionName, institutionType, learnerStage, loading, ready, refresh]
  );

  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>;
}

export function useLearner() {
  const context = useContext(LearnerContext);
  return context || defaultValue;
}
