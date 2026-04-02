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

  it('selects a random available theme after city selection', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          title: 'Heidelberg Kulturkarte',
          caption: 'Old university and calm river view',
          germanText: 'Ich bin heute in Heidelberg. Die Stadt hat eine alte Universität.',
          englishText: 'I am in Heidelberg today. The city has an old university.'
        })
    } as Response);

    renderExplorePage();

    await user.click(await screen.findByRole('button', { name: /选择城市 Heidelberg/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const payload = JSON.parse(String(request?.body ?? '{}')) as {
      cityId?: string;
      theme?: string;
      readingLevel?: string;
    };

    expect(payload.cityId).toBe('heidelberg');
    expect(payload.theme).toBe('culture');
    expect(payload.readingLevel).toBe('A1-A2');
  });

  it('opens postcard modal, toggles translation, and saves to album', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          title: 'Berlin am Wasser',
          caption: 'Spree walk and city lights',
          germanText: 'Ich bin heute in Berlin. Ich sehe die Spree und den Fernsehturm.',
          englishText: 'I am in Berlin today. I see the Spree and the TV Tower.',
          imageUrl: 'https://images.pexels.com/photos/1000/sample.jpg',
          imageSource: 'pexels-theme'
        })
    } as Response);

    renderExplorePage();

    await user.click(await screen.findByRole('button', { name: /选择城市 Berlin/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const payload = JSON.parse(String(request?.body ?? '{}')) as {
      cityId?: string;
      theme?: string;
      readingLevel?: string;
    };

    expect(payload.cityId).toBe('berlin');
    expect(payload.readingLevel).toBe('A1-A2');
    expect(typeof payload.theme).toBe('string');

    expect(await screen.findByRole('dialog', { name: '城市明信片' })).toBeInTheDocument();
    expect(screen.getByText('Berlin am Wasser')).toBeInTheDocument();
    expect(screen.getByText('Ich bin heute in Berlin. Ich sehe die Spree und den Fernsehturm.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Berlin am Wasser postcard' })).toHaveAttribute(
      'src',
      'https://images.pexels.com/photos/1000/sample.jpg'
    );

    await user.click(screen.getByRole('button', { name: '翻译成英文' }));
    expect(screen.getByText('I am in Berlin today. I see the Spree and the TV Tower.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '收藏明信片' }));
    await user.click(screen.getByRole('button', { name: /明信片收藏夹/ }));
    expect(await screen.findByRole('dialog', { name: '明信片收藏夹' })).toBeInTheDocument();

    const album = JSON.parse(window.localStorage.getItem(storageKeyMap.postcardAlbum) ?? '[]') as Array<{
      postcard: { title: string; imageUrl: string; imageSource?: string };
    }>;

    expect(album).toHaveLength(1);
    expect(album[0]?.postcard.title).toBe('Berlin am Wasser');
    expect(album[0]?.postcard.imageUrl).toBe('https://images.pexels.com/photos/1000/sample.jpg');
    expect(album[0]?.postcard.imageSource).toBe('pexels-theme');
    expect(screen.getByRole('button', { name: /Berlin am Wasser/ })).toBeInTheDocument();
  });

  it('shows friendly error when API returns empty response body', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => ''
    } as Response);

    renderExplorePage();

    await user.click(await screen.findByRole('button', { name: /选择城市 Berlin/i }));

    expect(await screen.findByText('AI 服务返回空响应，请稍后重试。')).toBeInTheDocument();
  });
});
