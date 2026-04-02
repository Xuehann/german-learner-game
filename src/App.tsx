import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useGameStore } from './store/gameStore';
import { ExplorePage } from './pages/ExplorePage';
import { GamePage } from './pages/GamePage';
import { UnitsPage } from './pages/UnitsPage';

function AppShell() {
  const initializeGame = useGameStore((state) => state.initializeGame);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  return (
    <Routes>
      <Route path="/" element={<GamePage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/units" element={<UnitsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
