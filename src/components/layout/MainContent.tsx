// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { BookOpen, Compass, Sparkles } from 'lucide-react';

export function MainContent() {
  return (
    <main className="flex-1 overflow-auto p-6">
      {/* Welcome State */}
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="max-w-lg space-y-6">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-400/20 to-blue-600/20 rounded-2xl flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-[var(--accent)]" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold">Welcome to EnZIM</h1>
          
          {/* Description */}
          <p className="text-secondary">
            Your offline knowledge companion. Load a ZIM archive to start exploring 
            encyclopedic content without an internet connection.
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="surface p-4 rounded-lg text-left">
              <Compass className="w-6 h-6 text-[var(--accent)] mb-2" />
              <h3 className="font-medium mb-1">Semantic Mesh</h3>
              <p className="text-xs text-secondary">
                Visualize connections between articles
              </p>
            </div>
            <div className="surface p-4 rounded-lg text-left">
              <Sparkles className="w-6 h-6 text-[var(--accent)] mb-2" />
              <h3 className="font-medium mb-1">AI Assistant</h3>
              <p className="text-xs text-secondary">
                Chat with your knowledge base
              </p>
            </div>
          </div>

          {/* CTA */}
          <button className="btn-primary px-6 py-3 rounded-lg font-medium">
            Open ZIM Archive
          </button>
        </div>
      </div>
    </main>
  );
}
