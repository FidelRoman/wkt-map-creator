"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthWrapper, { useAuth } from '@/components/AuthWrapper';
import { Project, getUserProjects, getSharedProjects, createProject, deleteProject, updateProjectName } from '@/lib/firebase';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import Modal from '@/components/Modal';
import ShareModal from '@/components/ShareModal';
import { PlusIcon, UserCircleIcon, EllipsisVerticalIcon, TrashIcon, PencilIcon, ShareIcon } from '@heroicons/react/24/outline';

function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);

  // Create State
  const [creating, setCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Context Menu State
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Action Modal States
  const [actionProject, setActionProject] = useState<Project | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Close menu on click outside
  useEffect(() => {
    const handleClick = () => setMenuOpenId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  const loadProjects = async () => {
    if (!user || !user.email) return;
    const pros = await getUserProjects(user.uid);
    setProjects(pros);
    const shared = await getSharedProjects(user.email);
    setSharedProjects(shared);
  };

  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return;
    setCreating(true);
    try {
      const { id } = await createProject(
        newProjectName,
        user.uid,
        user.displayName || "Usuario",
        user.email || ""
      );
      router.push(`/${id}`);
    } catch (e) {
      console.error(e);
      alert("Error al crear proyecto");
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!actionProject || !renameValue.trim()) return;
    setActionLoading(true);
    try {
      await updateProjectName(actionProject.id!, renameValue);
      setRenameModalOpen(false);
      loadProjects(); // Refresh list
    } catch (e) {
      console.error(e);
      alert("Error al renombrar");
    } finally {
      setActionLoading(false);
      setActionProject(null);
    }
  };

  const handleDelete = async () => {
    if (!actionProject) return;
    setActionLoading(true);
    try {
      await deleteProject(actionProject.id!);
      setDeleteModalOpen(false);
      loadProjects(); // Refresh list
    } catch (e) {
      console.error(e);
      alert("Error al eliminar");
    } finally {
      setActionLoading(false);
      setActionProject(null);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">WKT Map Creator</h1>
          <p className="text-slate-500 mb-8">Administra y visualiza tus proyectos geoespaciales</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-6 rounded-xl transition-all"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" width="20" height="20" />
            Continuar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 w-full">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          WKT Dashboard
        </h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 py-1.5 px-3 rounded-full">
            {user.photoURL ? (
              <img src={user.photoURL} className="w-6 h-6 rounded-full" />
            ) : (
              <UserCircleIcon className="w-6 h-6" />
            )}
            <span className="font-medium truncate max-w-[150px]">{user.displayName}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Mis Proyectos</h2>
            <p className="text-slate-500 mt-1">Selecciona un proyecto para comenzar a editar</p>
          </div>
          <button
            onClick={() => { setNewProjectName(""); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm shadow-blue-200"
          >
            <PlusIcon className="w-5 h-5" />
            Nuevo Proyecto
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
            <div className="inline-flex bg-slate-50 p-4 rounded-full mb-4">
              <PlusIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">No tienes proyectos aún</h3>
            <p className="text-slate-500 mt-1 mb-6">Crea tu primer proyecto para empezar a mapear</p>
            <button
              onClick={() => { setNewProjectName(""); setIsModalOpen(true); }}
              className="text-blue-600 font-medium hover:underline"
            >
              Crear Proyecto ahora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div key={project.id} className="relative group">
                <Link
                  href={`/${project.id}`}
                  className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col h-48"
                >
                  <div className="flex justify-between items-start mb-2 pr-8">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                      {project.updatedAt ? new Date(project.updatedAt.seconds * 1000).toLocaleDateString() : 'Reciente'}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 mb-1 pr-6">{project.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 flex-1">
                    {project.layers?.length || 0} capas &bull; {project.layers?.reduce((acc, l) => acc + (l.features?.features?.length || 0), 0) || 0} objetos
                  </p>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center text-sm text-blue-600 font-medium">
                    Abrir Proyecto &rarr;
                  </div>
                </Link>

                {/* Context Menu Trigger */}
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === project.id ? null : project.id!);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <EllipsisVerticalIcon className="w-6 h-6" />
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpenId === project.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        onClick={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          setActionProject(project);
                          setRenameValue(project.name);
                          setRenameModalOpen(true);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Cambiar nombre
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          setActionProject(project);
                          setShareModalOpen(true);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                      >
                        <ShareIcon className="w-4 h-4" />
                        Compartir
                      </button>
                      <div className="h-px bg-slate-100 my-1"></div>
                      <button
                        onClick={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          setActionProject(project);
                          setDeleteModalOpen(true);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Shared Projects */}
        {sharedProjects.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Compartidos Conmigo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedProjects.map(project => (
                <Link
                  href={`/${project.id}`}
                  key={project.id}
                  className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col h-48"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-green-50 rounded-lg text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                      {project.updatedAt ? new Date(project.updatedAt.seconds * 1000).toLocaleDateString() : 'Reciente'}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 mb-1">{project.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 flex-1">
                    De: {project.ownerName ? `${project.ownerName} (${project.ownerEmail})` : (project.ownerEmail || project.ownerId)}
                  </p>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center text-sm text-green-600 font-medium">
                    Abrir Compartido &rarr;
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Crear Nuevo Proyecto"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleCreateProject}
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {creating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creando...
                </>
              ) : 'Crear Proyecto'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">Nombre del Proyecto</label>
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej. Mapa de Cultivos 2024"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
          />
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title="Cambiar nombre"
        footer={
          <>
            <button onClick={() => setRenameModalOpen(false)} className="btn-outline">Cancelar</button>
            <button onClick={handleRename} disabled={actionLoading} className="btn-primary">
              {actionLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <input
          type="text"
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Eliminar Proyecto"
        footer={
          <>
            <button onClick={() => setDeleteModalOpen(false)} className="btn-outline">Cancelar</button>
            <button onClick={handleDelete} disabled={actionLoading} className="btn-primary bg-red-600 hover:bg-red-700">
              {actionLoading ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        }
      >
        <p className="text-slate-600">
          ¿Estás seguro de que quieres eliminar <b>{actionProject?.name}</b>? Esta acción no se puede deshacer.
        </p>
      </Modal>

      {/* Share Modal */}
      {actionProject && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          project={actionProject}
          onUpdate={() => loadProjects()}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <AuthWrapper>
      <Dashboard />
    </AuthWrapper>
  );
}
