"use client";
import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile, createUserProfile, type UserProfile } from "@/lib/firebase";


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
        if (!profile) {
            profile = await createUserProfile(
                firebaseUser.uid,
                firebaseUser.email ?? '',
                firebaseUser.displayName ?? ''
            );
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
