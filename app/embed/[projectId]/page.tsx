import { getProject } from '@/lib/firebase';
import EmbedViewer from './EmbedViewer';
import { notFound } from 'next/navigation';

interface EmbedPageProps {
    params: Promise<{ projectId: string }>;
}

export default async function EmbedPage({ params }: EmbedPageProps) {
    const { projectId } = await params;
    const project = await getProject(projectId);

    if (!project || !project.isPublic) {
        notFound();
    }

    return <EmbedViewer project={project} />;
}
