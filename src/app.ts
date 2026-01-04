import { ReactNode, useEffect } from 'react';
import { initRouteGuard } from './utils/routeGuard';
import { initCategories } from './utils/category';

import './app.scss';

interface AppProps {
  children?: ReactNode;
}

const App = ({ children }: AppProps) => {
  useEffect(() => {
    // 初始化路由守卫
    initRouteGuard();
    // 初始化分类数据
    initCategories();
  }, []);

  return children as ReactNode;
};

export default App;
