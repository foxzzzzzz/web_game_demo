import { GameShell } from '../ui/GameShell';
import type { GameUiActions, GameViewModel } from '../ui/types';
import '../styles/game.css';

export interface AppProps {
  viewModel: GameViewModel;
  actions: GameUiActions;
}

/** Store/runtime adapter is intentionally injected by the application entrypoint. */
export function App({ viewModel, actions }: AppProps) {
  return <GameShell viewModel={viewModel} actions={actions} />;
}
