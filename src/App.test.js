import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Please log in' }) }));
});

test('renders the MindSight header and chat entry point', () => {
  render(<App />);
  expect(screen.getByText(/MindSight — AI-powered Mental Health Companion/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument();
});
