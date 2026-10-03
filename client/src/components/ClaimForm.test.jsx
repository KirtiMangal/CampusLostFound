import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../context/ToastContext.jsx';
import { itemApi } from '../services/api.js';
import ClaimForm from './ClaimForm.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ClaimForm', () => {
  it('requires a message and submits only after the user confirms the form', async () => {
    const create = vi.spyOn(itemApi, 'createClaim').mockResolvedValue({ data: { status: 'pending' } });
    render(<ToastProvider><ClaimForm itemId="found-1" /></ToastProvider>);
    expect(screen.getByRole('button', { name: 'Submit claim' }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Why do you believe/), { target: { value: 'There is a small green keychain inside.' } });
    expect(screen.getByText('39/2000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Submit claim' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith('found-1', { claimMessage: 'There is a small green keychain inside.' }));
    expect(await screen.findByText('Claim submitted')).toBeTruthy();
    expect(screen.getByText(/pending review/i)).toBeTruthy();
  });

  it('shows API errors without pretending the claim was submitted', async () => {
    vi.spyOn(itemApi, 'createClaim').mockRejectedValue({ response: { data: { message: 'Item already resolved.' } } });
    render(<ToastProvider><ClaimForm itemId="found-1" /></ToastProvider>);
    fireEvent.change(screen.getByLabelText(/Why do you believe/), { target: { value: 'A distinctive mark.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit claim' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Item already resolved.');
    expect(screen.queryByText('Claim submitted')).toBeNull();
  });
});
