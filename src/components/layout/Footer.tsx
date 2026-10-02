export default function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200 py-6 text-center transition-colors dark:border-stone-800">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        &copy; {new Date().getFullYear()} &mdash; 用 ☕ 制作 by{" "}
        <a
          href="https://github.com/Shtskysmile"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Shtskysmile
        </a>
      </p>
    </footer>
  );
}
