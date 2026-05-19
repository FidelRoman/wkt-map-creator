"use client";
import { useState } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { PLAN_LIMITS, type PlanId } from '@/lib/plans';
import UpgradeModal from './UpgradeModal';
import { useRouter } from 'next/navigation';
import type { ToastType } from './Toast';

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
    onShowToast?: (message: string, type?: ToastType) => void;
}

export default function PlanBadge({ plan, projectCount, onShowToast }: PlanBadgeProps) {
    const [showUpgrade, setShowUpgrade] = useState(false);
    const router = useRouter();

    const maxProjects = PLAN_LIMITS[plan].maxProjects;

    const handleManage = () => {
        if (plan === 'free') {
            setShowUpgrade(true);
        } else {
            router.push('/settings');
        }
    };

    return (
        <>
            <button
                onClick={handleManage}
                aria-label={plan === 'free' ? 'Upgrade a Pro' : 'Gestionar suscripción'}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left group"
            >
                <div
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-xs font-bold flex-shrink-0"
                    style={{ background: PLAN_COLORS[plan] }}
                >
                    {plan !== 'free' && <SparklesIcon className="w-3 h-3" />}
                    {PLAN_LABELS[plan]}
                </div>

                {plan === 'free' && maxProjects !== null && projectCount !== undefined && (
                    <div className="flex-1 min-w-0">
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
                    <span className="ml-auto text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Gestionar →
                    </span>
                )}
            </button>

            <UpgradeModal
                isOpen={showUpgrade}
                onClose={() => setShowUpgrade(false)}
                onShowToast={onShowToast}
            />
        </>
    );
}
