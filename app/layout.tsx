export const metadata = {
  title: "Text → Video Generator",
  description: "Generate short videos from text prompts in your browser"
};

import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <header className="header">
            <div className="brand">
              <span className="logo">🎬</span>
              <h1>Text → Video</h1>
            </div>
            <a className="repo" href="https://vercel.com" target="_blank" rel="noreferrer">Powered by Next.js</a>
          </header>
          <main className="main">{children}</main>
          <footer className="footer">Built with Canvas + MediaRecorder</footer>
        </div>
      </body>
    </html>
  );
}
