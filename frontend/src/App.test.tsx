import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('App routing shell', () => {
  it('renders the landing dashboard shell', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText(/AI financial operating system/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
  });
});
