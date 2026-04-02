import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storageKeyMap } from '../lib/storage';
import { useExploreStore } from '../store/exploreStore';
import { ExplorePage } from './ExplorePage';

const renderExplorePage = () =>
  render(
    <BrowserRouter>
      <ExplorePage />
    </BrowserRouter>
  );

describe('ExplorePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useExploreStore.getState().resetExploreState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disables unavailable themes for a city with incomplete facts', async () => {
    const user = userEvent.setup();
    renderExplorePage();

    await user.click(await screen.findByRole('button', { name: /Heidelberg/i }));

    const festivalsButton = screen.getByRole('button', { name: /节日/ });
    expect(festivalsButton).toBeDisabled();
    expect(screen.getByText('海德堡适合浪漫、大学城和老城阅读；节庆资料在 v1 先不开放，用来测试主题禁用态。')).toBeInTheDocument();
  });

  it('generates a postcard, toggles translation, and saves to album', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          title: 'Berlin am Wasser',
          caption: 'Spree walk and city lights',
          germanText: 'Ich bin heute in Berlin. Ich sehe die Spree und den Fernsehturm.',
          englishText: 'I am in Berlin today. I see the Spree and the TV Tower.'
        })
    } as Response);

    renderExplorePage();

    await user.click(await screen.findByRole('button', { name: /Berlin/i }));
    await user.click(screen.getByRole('button', { name: /景点/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/postcards/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          cityId: 'berlin',
          theme: 'landmarks',
          readingLevel: 'A1-A2'
        })
      })
    );

    expect(await screen.findByText('Berlin am Wasser')).toBeInTheDocument();
    expect(screen.getByText('Ich bin heute in Berlin. Ich sehe die Spree und den Fernsehturm.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '翻译成英文' }));
    expect(screen.getByText('I am in Berlin today. I see the Spree and the TV Tower.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '收藏明信片' }));

    const album = JSON.parse(window.localStorage.getItem(storageKeyMap.postcardAlbum) ?? '[]') as Array<{
      postcard: { title: string };
    }>;

    expect(album).toHaveLength(1);
    expect(album[0]?.postcard.title).toBe('Berlin am Wasser');
    expect(screen.getByRole('button', { name: /Berlin am Wasser/ })).toBeInTheDocument();
  });

  it('shows friendly error when API returns empty response body', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => ''
    } as Response);

    renderExplorePage();

    await user.click(await screen.findByRole('button', { name: /Berlin/i }));
    await user.click(screen.getByRole('button', { name: /景点/ }));

    expect(await screen.findByText('AI 服务返回空响应，请稍后重试。')).toBeInTheDocument();
  });
});
