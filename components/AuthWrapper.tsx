"use client";
import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile, createUserProfile, type UserProfile } from "@/lib/firebase";
import { analytics, identify } from "@/lib/analytics";


interface AuthContextType {
    user: User | null;
    loading: boolean;
    userProfile: UserProfile | null;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    userProfile: null,
    refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    const loadProfile = useCallback(async (firebaseUser: User) => {
        let profile = await getUserProfile(firebaseUser.uid);
        const isNewUser = !profile;
        if (!profile) {
            profile = await createUserProfile(
                firebaseUser.uid,
                firebaseUser.email ?? '',
                firebaseUser.displayName ?? ''
            );
        }
        // Fire analytics after we know the plan
        if (profile) {
            identify(firebaseUser.uid, { email: firebaseUser.email ?? '', plan: profile.plan });
            if (isNewUser) {
                analytics.signUp();
            } else {
                analytics.signIn(profile.plan);
            }
        }
        // Fallback: if webhook missed and period already ended, downgrade locally
        if (
            profile &&
            profile.plan === 'pro' &&
            profile.subscriptionStatus === 'canceled' &&
            profile.currentPeriodEnd
        ) {
            const endMs = profile.currentPeriodEnd?.seconds
                ? profile.currentPeriodEnd.seconds * 1000
                : new Date(profile.currentPeriodEnd).getTime();
            if (Date.now() > endMs) {
                profile = { ...profile, plan: 'free' };
            }
        }
        setUserProfile(profile);
    }, []);

    const refreshProfile = useCallback(async () => {
        if (user) await loadProfile(user);
    }, [user, loadProfile]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                await loadProfile(firebaseUser);
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [loadProfile]);

    return (
        <AuthContext.Provider value={{ user, loading, userProfile, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}
