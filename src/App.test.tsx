import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { useGameStore } from './store/gameStore';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('renders game page by default and hides import panel', async () => {
    render(<App />);

    expect(await screen.findByText('Wortwurst Metzgerei')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '出门旅游' })).toBeInTheDocument();
    expect(screen.queryByText('词库导入与 AI 生成')).not.toBeInTheDocument();
  });

  it('supports direct /units route render', async () => {
    window.history.pushState({}, '', '/units');

    render(<App />);
    expect(await screen.findByText('词库中心')).toBeInTheDocument();
  });

  it('supports direct /explore route render', async () => {
    window.history.pushState({}, '', '/explore');

    render(<App />);
    expect(await screen.findByText('Voxel 德国地图')).toBeInTheDocument();
  });

  it('shows 推门营业 and 出门旅游 in intro_door and enters intro_goal on click', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Wortwurst Metzgerei')).toBeInTheDocument();

    act(() => {
      useGameStore.setState({ phase: 'intro_door' });
    });

    expect(screen.getByRole('button', { name: '推门营业' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '出门旅游' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: '跳过开门动画' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '推门营业' }));
    expect(screen.getByText('今日运营目标')).toBeInTheDocument();
  });

  it('navigates between game, explore, and units pages', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('link', { name: '出门旅游' }));
    expect(await screen.findByText('Voxel 德国地图')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '返回营业台' }));
    expect(await screen.findByText('Wortwurst Metzgerei')).toBeInTheDocument();

    await user.click(await screen.findByRole('link', { name: '词库中心' }));
    expect(await screen.findByText('词库中心')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '返回营业台' }));
    expect(await screen.findByText('Wortwurst Metzgerei')).toBeInTheDocument();
  });
});
