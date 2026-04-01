import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders core game title', async () => {
    render(<App />);
    expect(await screen.findByText('德国肉铺切香肠')).toBeInTheDocument();
  });
});
