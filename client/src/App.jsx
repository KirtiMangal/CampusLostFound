import { Route, Routes } from 'react-router-dom';
import Layout from './layouts/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ReportItemPage from './pages/ReportItemPage.jsx';
import ItemsPage from './pages/ItemsPage.jsx';
import ItemDetailsPage from './pages/ItemDetailsPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';

export default function App() {
  return <Routes><Route element={<Layout />}>
    <Route index element={<HomePage />} />
    <Route path="login" element={<LoginPage />} />
    <Route path="register" element={<RegisterPage />} />
    <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="report/lost" element={<ProtectedRoute><ReportItemPage type="lost" /></ProtectedRoute>} />
    <Route path="report/found" element={<ProtectedRoute><ReportItemPage type="found" /></ProtectedRoute>} />
    <Route path="items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
    <Route path="items/:id" element={<ProtectedRoute><ItemDetailsPage /></ProtectedRoute>} />
    <Route path="notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
    <Route path="admin" element={<ProtectedRoute roles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />
    <Route path="*" element={<PlaceholderPage title="Page not found" description="That page doesn't exist. Head back to the home page to find your way." />} />
  </Route></Routes>;
}
