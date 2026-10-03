import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { authApi, authToken } from '../services/api.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

it('redirects an authenticated student away from admin routes', async () => {
  authToken.set('student-token');
  vi.spyOn(authApi, 'me').mockResolvedValue({ user: { id: 'student-1', name: 'Student', role: 'student', email: 'student@example.edu' } });
  render(<AuthProvider><MemoryRouter initialEntries={['/admin']}><Routes>
    <Route path="/admin" element={<ProtectedRoute roles={['admin']}><p>Admin content</p></ProtectedRoute>} />
    <Route path="/dashboard" element={<p>Student dashboard</p>} />
  </Routes></MemoryRouter></AuthProvider>);
  expect(await screen.findByText('Student dashboard')).toBeTruthy();
  expect(screen.queryByText('Admin content')).toBeNull();
});
