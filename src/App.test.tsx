import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useGameStore } from './store/gameStore';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () => new Promise(() => {
          // Keep pending in tests to avoid unrelated async state churn.
        })
      )
    );
  });

  it('renders game page by default and hides import panel', async () => {
    render(<App />);

    expect(await screen.findByRole('button', { name: '推门营业' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '出门旅游' }).length).toBeGreaterThanOrEqual(1);
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
    expect(await screen.findByText('德国地图')).toBeInTheDocument();
  });

  it('shows 推门营业 and 出门旅游 in intro_door and enters intro_goal on click', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('button', { name: '推门营业' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '出门旅游' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: '跳过开门动画' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '推门营业' }));
    expect(screen.getByText('今日运营目标')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '开始营业' }));
    expect(screen.queryByText('今日运营目标')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('例如: der Apfel')).toBeInTheDocument();
  });

  it('navigates between game, explore, and units pages', async () => {
    const user = userEvent.setup();
    render(<App />);

    const exploreLinks = await screen.findAllByRole('link', { name: '出门旅游' });
    await user.click(exploreLinks[0]!);
    expect(await screen.findByText('德国地图')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '返回营业台' }));
    expect(await screen.findByRole('button', { name: '推门营业' })).toBeInTheDocument();

    await user.click(await screen.findByRole('link', { name: '词库中心' }));
    expect(await screen.findByText('词库中心')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '返回营业台' }));
    expect(await screen.findByRole('button', { name: '推门营业' })).toBeInTheDocument();
  });

  it('shows whole sausage during serving_order', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: '推门营业' })).toBeInTheDocument();

    act(() => {
      useGameStore.setState({
        phase: 'serving_order',
        feedback: null
      });
    });

    expect(screen.getByTestId('knife')).toBeInTheDocument();
    expect(screen.getByTestId('sausage-whole')).toBeInTheDocument();
    expect(screen.queryByTestId('sausage-half-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sausage-half-right')).not.toBeInTheDocument();
  });

  it('shows split sausage on correct feedback', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: '推门营业' })).toBeInTheDocument();

    act(() => {
      useGameStore.setState({
        phase: 'show_order_feedback',
        feedback: {
          type: 'correct',
          title: '订单完成',
          speech: 'Gut gemacht!',
          correctAnswer: 'der Apfel',
          userInput: 'der Apfel',
          masteryHint: '1/3'
        }
      });
    });

    expect(screen.getByTestId('knife')).toBeInTheDocument();
    expect(screen.queryByTestId('sausage-whole')).not.toBeInTheDocument();
    expect(screen.getByTestId('sausage-half-left')).toBeInTheDocument();
    expect(screen.getByTestId('sausage-half-right')).toBeInTheDocument();
    expect(screen.getByTestId('order-feedback-card')).toHaveClass('bg-[#e9ffdb]');
    expect(screen.getByText('掌握进度: 1/3')).toBeInTheDocument();
    expect(screen.getByText('点击继续（桌面可按 Enter）')).toBeInTheDocument();
    expect(screen.queryByText(/^正确答案:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^你的输入:/)).not.toBeInTheDocument();
  });

  it('keeps whole sausage on wrong or skip feedback and uses red feedback style', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: '推门营业' })).toBeInTheDocument();

    act(() => {
      useGameStore.setState({
        phase: 'show_order_feedback',
        feedback: {
          type: 'wrong',
          title: '订单出错',
          speech: 'Das war nicht richtig.',
          correctAnswer: 'der Apfel',
          userInput: 'die Apfel',
          masteryHint: '1/3',
          requiresManualContinue: true
        }
      });
    });

    expect(screen.getByTestId('sausage-whole')).toBeInTheDocument();
    expect(screen.queryByTestId('sausage-half-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sausage-half-right')).not.toBeInTheDocument();
    expect(screen.getByTestId('order-feedback-card')).toHaveClass('bg-[#ffe3de]');
    expect(screen.getByText(/^正确答案:/)).toBeInTheDocument();
    expect(screen.getByText(/^你的输入:/)).toBeInTheDocument();
    expect(screen.getByText('掌握进度: 1/3')).toBeInTheDocument();

    act(() => {
      useGameStore.setState({
        phase: 'show_order_feedback',
        feedback: {
          type: 'skip',
          title: '你跳过了订单',
          speech: 'Ich warte dann auf die naechste Bestellung.',
          correctAnswer: 'der Apfel',
          userInput: '',
          masteryHint: '2/3',
          requiresManualContinue: true
        }
      });
    });

    expect(screen.getByTestId('sausage-whole')).toBeInTheDocument();
    expect(screen.queryByTestId('sausage-half-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sausage-half-right')).not.toBeInTheDocument();
    expect(screen.getByTestId('order-feedback-card')).toHaveClass('bg-[#ffe3de]');
    expect(screen.getByText('掌握进度: 2/3')).toBeInTheDocument();
  });

  it('resets to whole sausage after leaving correct feedback', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: '推门营业' })).toBeInTheDocument();

    act(() => {
      useGameStore.setState({
        phase: 'show_order_feedback',
        feedback: {
          type: 'correct',
          title: '订单完成',
          speech: 'Sehr gut!',
          correctAnswer: 'der Apfel',
          userInput: 'der Apfel'
        }
      });
    });

    expect(screen.getByTestId('sausage-half-left')).toBeInTheDocument();
    expect(screen.getByTestId('sausage-half-right')).toBeInTheDocument();

    act(() => {
      useGameStore.setState({
        phase: 'serving_order',
        feedback: null
      });
    });

    expect(screen.getByTestId('sausage-whole')).toBeInTheDocument();
    expect(screen.queryByTestId('sausage-half-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sausage-half-right')).not.toBeInTheDocument();
  });

  it('continues to next order when pressing Enter in feedback phase', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: '推门营业' })).toBeInTheDocument();

    act(() => {
      useGameStore.setState({
        phase: 'show_order_feedback',
        feedback: {
          type: 'correct',
          title: '订单完成',
          speech: 'Gut!',
          correctAnswer: 'der Apfel',
          userInput: 'der Apfel',
          requiresManualContinue: true
        }
      });
    });

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(useGameStore.getState().phase).toBe('serving_order');
  });

  it('continues to next order when clicking feedback card', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('button', { name: '推门营业' })).toBeInTheDocument();

    act(() => {
      useGameStore.setState({
        phase: 'show_order_feedback',
        feedback: {
          type: 'wrong',
          title: '订单出错',
          speech: 'Fast!',
          correctAnswer: 'der Apfel',
          userInput: 'die Apfel',
          requiresManualContinue: true
        }
      });
    });

    await user.click(screen.getByTestId('order-feedback-card'));
    expect(useGameStore.getState().phase).toBe('serving_order');
  });
});
