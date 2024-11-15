import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders rebalancing message', () => {
  render(<App />);
  const linkElement = screen.getByText(/Fill in your fund information to rebalance your portfolio/i);
  expect(linkElement).toBeInTheDocument();
});
