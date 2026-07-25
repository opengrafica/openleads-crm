import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { ThemeProvider } from '@/hooks/useTheme'
import { AppLayout } from '@/components/layout/AppLayout'
import { AdminRoute, ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SearchPage } from '@/pages/SearchPage'
import { CrmPage } from '@/pages/CrmPage'
import { WhatsAppPage } from '@/pages/WhatsAppPage'
import { AdminPage } from '@/pages/AdminPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="busca" element={<SearchPage />} />
                <Route path="crm" element={<CrmPage />} />
                <Route path="whatsapp" element={<WhatsAppPage />} />
                <Route path="pipeline" element={<Navigate to="/crm" replace />} />
                <Route path="tarefas" element={<Navigate to="/crm" replace />} />
                <Route element={<AdminRoute />}>
                  <Route path="admin" element={<AdminPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
