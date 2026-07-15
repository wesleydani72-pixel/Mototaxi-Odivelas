/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastContainer } from './components/common/ToastContainer';
import { Header } from './components/common/Header';
import { Login } from './components/Login';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { DriverDashboard } from './components/driver/DriverDashboard';
import { ClientDashboard } from './components/client/ClientDashboard';
import { ClientCompleteProfile } from './components/client/ClientCompleteProfile';
import { SecretAdminPortal } from './components/admin/SecretAdminPortal';
import { ImageLightbox } from './components/common/ImageLightbox';

function AppContent() {
  const { currentUser, isSecretAdminUnlocked } = useAuth();
  const [lightboxImage, setLightboxImage] = React.useState<{ src: string; alt: string } | null>(null);

  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null;
      while (target && target.tagName !== 'IMG') {
        target = target.parentElement;
        if (target === document.body || target === document.documentElement) {
          break;
        }
      }

      if (target && target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        
        // Skip if inside the lightbox itself or has explicit ignore
        if (img.closest('.z-\\[9999\\]') || img.classList.contains('no-lightbox')) {
          return;
        }

        if (img.src) {
          // Ignore tiny tracking/spacer/decorative images (e.g., width & height < 16px)
          if (img.naturalWidth > 0 && img.naturalWidth < 16 && img.naturalHeight < 16) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          setLightboxImage({
            src: img.src,
            alt: img.alt || 'Visualização da Foto'
          });
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/painel-secreto-admin" element={<SecretAdminPortal />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const showAdmin = currentUser.role === 'admin' || isSecretAdminUnlocked;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 w-full">
      <Routes>
        <Route path="/painel-secreto-admin" element={<SecretAdminPortal />} />
        <Route path="*" element={
          <div className="flex flex-col h-full overflow-hidden w-full">
            <Header />
            <main className="flex-1 flex flex-col overflow-hidden relative">
              {showAdmin && <AdminDashboard />}
              {!showAdmin && currentUser.role === 'mototaxista' && <DriverDashboard />}
              {!showAdmin && currentUser.role === 'cliente' && (
                (currentUser as any).cadastroCompleto ? <ClientDashboard /> : <ClientCompleteProfile />
              )}
            </main>
          </div>
        } />
      </Routes>
      <ToastContainer />

      {/* Global Image Viewer Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          alt={lightboxImage.alt}
          onClose={() => setLightboxImage(null)}
          isAdmin={showAdmin}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  );
}


