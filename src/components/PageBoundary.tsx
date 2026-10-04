import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * 路由级错误边界。
 *
 * 页面是按路由 lazy 加载的，每次部署 JS 文件的哈希都会变。用户停在旧页面上时，
 * 手里的 index.html 还引用着旧 chunk 名，点导航去加载新页面就会 404：
 * 「Failed to fetch dynamically imported module」。没有边界的话 React 会卸载整棵树，
 * 连 Header 一起白屏，看起来就是「点了没反应，刷新才好」——刷新会拿到新 index.html。
 *
 * 所以这里兜住它，把「这个页面没加载出来」和「整个站挂了」分开。
 */
export default class PageBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="surface-panel mx-auto my-24 flex w-[calc(100%-2rem)] max-w-3xl flex-col items-center justify-center p-10 text-center">
        <h1 className="mb-2 font-heading text-2xl text-stone-800 dark:text-stone-100">
          页面加载失败
        </h1>
        <p className="mb-6 max-w-md text-sm text-stone-500 dark:text-stone-400">
          网站最近更新过，你手上的版本已经过期了。刷新一下就好。
        </p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm text-white transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          刷新页面
        </button>
      </div>
    );
  }
}
