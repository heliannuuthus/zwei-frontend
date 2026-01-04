import { ReactNode, useEffect } from 'react';
import { initRouteGuard } from './utils/routeGuard';

import './app.scss';

interface AppProps {
  children?: ReactNode;
}

const App = ({ children }: AppProps) => {
  useEffect(() => {
    // 初始化路由守卫
    initRouteGuard();
  }, []);

  return children as ReactNode;
};

export default App;
