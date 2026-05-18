"use client";
import { useState } from 'react';
import { SparklesIcon, CogIcon } from '@heroicons/react/24/outline';
import { PLAN_LIMITS, type PlanId } from '@/lib/plans';
import UpgradeModal from './UpgradeModal';
import { useAuth } from './AuthWrapper';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const PLAN_COLORS: Record<PlanId, string> = {
    free: '#6b7280',
    pro: '#6366f1',
    business: '#f59e0b',
};

const PLAN_LABELS: Record<PlanId, string> = {
    free: 'Free',
    pro: 'Pro',
    business: 'Business',
};

interface PlanBadgeProps {
    plan: PlanId;
    projectCount?: number;
}

export default function PlanBadge({ plan, projectCount }: PlanBadgeProps) {
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [loadingPortal, setLoadingPortal] = useState(false);
    const { user } = useAuth();

    const maxProjects = PLAN_LIMITS[plan].maxProjects;

    const handleManage = async () => {
        if (plan === 'free') {
            setShowUpgrade(true);
            return;
        }
        if (!user) return;
        setLoadingPortal(true);
        try {
            const token = await getIdToken(auth.currentUser!);
            const res = await fetch('/api/ls/customer-portal', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
        } catch {
            alert('Error al abrir el portal. Intenta de nuevo.');
        } finally {
            setLoadingPortal(false);
        }
    };

    return (
        <>
            <button
                onClick={handleManage}
                disabled={loadingPortal}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left group"
                title={plan === 'free' ? 'Upgrade a Pro' : 'Gestionar suscripción'}
            >
                <div
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-xs font-bold"
                    style={{ background: PLAN_COLORS[plan] }}
                >
                    {plan !== 'free' && <SparklesIcon className="w-3 h-3" />}
                    {PLAN_LABELS[plan]}
                </div>

                {plan === 'free' && maxProjects !== null && projectCount !== undefined && (
                    <div className="flex-1">
                        <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                            <span>Proyectos</span>
                            <span>{projectCount}/{maxProjects}</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${Math.min(100, (projectCount / maxProjects) * 100)}%`,
                                    background: projectCount >= maxProjects ? '#ef4444' : '#6366f1',
                                }}
                            />
                        </div>
                    </div>
                )}

                {plan !== 'free' && (
                    <CogIcon className="w-4 h-4 text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </button>

            <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
        </>
    );
}
