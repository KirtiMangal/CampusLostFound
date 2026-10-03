import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../context/ToastContext.jsx';
import { claimApi, itemApi } from '../services/api.js';
import ClaimReview from './ClaimReview.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ClaimReview', () => {
  it('lets the owner approve a pending claim and only then shows claimant contact', async () => {
    let status = 'pending';
    vi.spyOn(itemApi, 'claims').mockImplementation(async () => ({ data: [{ id: 'claim-1', claimant: { name: 'Student A' }, claimMessage: 'A unique mark inside.', status, createdAt: '2026-09-01' }] }));
    vi.spyOn(claimApi, 'approve').mockImplementation(async () => { status = 'approved'; return { data: { status } }; });
    const contact = vi.spyOn(claimApi, 'contact').mockResolvedValue({ data: { name: 'Student A', email: 'student-a@example.edu' } });
    render(<ToastProvider><ClaimReview itemId="found-1" /></ToastProvider>);
    expect(await screen.findByText('A unique mark inside.')).toBeTruthy();
    expect(screen.queryByText('student-a@example.edu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('student-a@example.edu')).toBeTruthy();
    expect(contact).toHaveBeenCalledWith('claim-1');
    await waitFor(() => expect(screen.getByText('approved')).toBeTruthy());
  });
});
