import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('App routing shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the landing dashboard shell', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Your money, finally in focus/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create account/i })).toBeInTheDocument();
  });

  it('redirects unauthenticated dashboard visits to login', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /your financial picture awaits/i })).toBeInTheDocument();
  });

  it('logs in through the API and persists the returned token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'signed-test-token', user: { id: 'user-1', name: 'Alex', email: 'alex@example.com' } })
    }));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'StrongPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(window.localStorage.getItem('expense_tracker_token')).toBe('signed-test-token'));
    expect(screen.getByText(/your financial picture/i)).toBeInTheDocument();
  });
});
