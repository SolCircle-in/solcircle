import React from "react"
import { Logo } from "./logo"

export function Footer() {
  return (
    <footer className="bg-black border-t border-white/10 py-6 px-4">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="col-span-1 md:col-span-2">
            <Logo className="mb-4" />
            <p className="text-white/70 mb-4 max-w-md">
              Group investing made easy on Solana. Pool, vote, and grow together right from your Telegram.
            </p>
            <p className="text-sm text-white/50 italic">"Squad up, turn chat into action, and win as a team."</p>
            
            <div className="mt-4 flex gap-4">
              <a 
                href="https://x.com/SolCircle_IN" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors"
                aria-label="Follow us on X (Twitter)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a 
                href="https://t.me/IL0dH0WbcW" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors"
                aria-label="Join our Telegram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                </svg>
              </a>
              <a 
                href="mailto:solcircleindia@gmail.com"
                className="text-white/70 hover:text-white transition-colors"
                aria-label="Email us"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Product</h3>
            <ul className="space-y-2 text-white/70">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="/dashboard" className="hover:text-white transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/groups" className="hover:text-white transition-colors">
                  My Groups
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Community</h3>
            <ul className="space-y-2 text-white/70">
              <li>
                <a href="https://x.com/SolCircle_IN" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  X (Twitter)
                </a>
              </li>
              <li>
                <a href="https://t.me/IL0dH0WbcW" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  Telegram
                </a>
              </li>
              <li>
                <a href="mailto:solcircleindia@gmail.com" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Documentation
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-4 pt-4 text-center text-white/50 text-sm">
          <p>&copy; 2025 SolCircle. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
