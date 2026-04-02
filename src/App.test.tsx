import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('renders game page by default and hides import panel', async () => {
    render(<App />);

    expect(await screen.findByText('Wortwurst Metzgerei')).toBeInTheDocument();
    expect(screen.queryByText('词库导入与 AI 生成')).not.toBeInTheDocument();
  });

  it('supports direct /units route render', async () => {
    window.history.pushState({}, '', '/units');

    render(<App />);
    expect(await screen.findByText('词库中心')).toBeInTheDocument();
  });

  it('navigates between game and units pages', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('link', { name: '词库中心' }));
    expect(await screen.findByText('词库中心')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '返回营业台' }));
    expect(await screen.findByText('Wortwurst Metzgerei')).toBeInTheDocument();
  });
});
