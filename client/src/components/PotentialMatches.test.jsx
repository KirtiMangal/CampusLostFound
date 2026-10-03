import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { itemApi } from '../services/api.js';
import PotentialMatches from './PotentialMatches.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const match = { matchId: 'match-1', finalScore: 84, classification: 'strong_candidate', matchingSignals: ['Same category'], item: { id: 'item-2', title: 'Blue bottle', description: 'Steel bottle with sticker', type: 'found', category: 'Accessories', location: 'Library', date: '2026-10-01', images: [] } };

function renderMatches(enabled = true) {
  return render(<MemoryRouter><PotentialMatches itemId="item-1" enabled={enabled} /></MemoryRouter>);
}

describe('PotentialMatches', () => {
  it('loads owner scoped potential matches and shows confidence and evidence', async () => {
    vi.spyOn(itemApi, 'matches').mockResolvedValue({ data: [match] });
    renderMatches();
    expect(screen.getByRole('status').textContent).toMatch(/Loading/);
    expect(await screen.findByRole('link', { name: 'Blue bottle' })).toBeTruthy();
    expect(screen.getByText('84% match score')).toBeTruthy();
    expect(screen.getByText('Same category')).toBeTruthy();
    expect(itemApi.matches).toHaveBeenCalledWith('item-1');
  });

  it('handles empty results and lets the owner refresh stored matches', async () => {
    const api = vi.spyOn(itemApi, 'matches').mockResolvedValue({ data: [] });
    renderMatches();
    expect(await screen.findByText(/No potential matches found yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  });

  it('shows a recoverable error and remains hidden when the viewer cannot manage the report', async () => {
    const api = vi.spyOn(itemApi, 'matches').mockRejectedValue({ response: { data: { message: 'Could not load matches.' } } });
    renderMatches(false);
    expect(screen.queryByText('Potential Matches')).toBeNull();
    expect(api).not.toHaveBeenCalled();
    renderMatches(true);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  });
});
