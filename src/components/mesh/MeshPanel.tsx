// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useState } from 'react';
import { X, Network, Sparkles, Link2, ChevronRight } from 'lucide-react';
import { getEntitlementsGatekeeper } from '../../entitlements';

interface MeshNode {
  id: string;
  title: string;
  type: 'article' | 'concept' | 'entity';
  relevance: number;
}

interface MeshPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentArticleTitle?: string;
}

export function MeshPanel({ isOpen, onClose, currentArticleTitle }: MeshPanelProps) {
  const [activeTab, setActiveTab] = useState<'related' | 'concepts' | 'links'>('related');
  const canViewMesh = getEntitlementsGatekeeper().can('mesh.view');
  
  // Placeholder data
  const mockNodes: MeshNode[] = [
    { id: '1', title: 'Related Article 1', type: 'article', relevance: 0.95 },
    { id: '2', title: 'Key Concept', type: 'concept', relevance: 0.88 },
    { id: '3', title: 'Named Entity', type: 'entity', relevance: 0.82 },
    { id: '4', title: 'Another Related', type: 'article', relevance: 0.75 },
  ];

  if (!isOpen) return null;

  if (!canViewMesh) {
    return (
      <div className="w-80 border-l border-[var(--border)] bg-[var(--bg-surface)] flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-[var(--accent)]" />
            <span className="font-medium">Semantic Mesh</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <Network className="w-12 h-12 mx-auto mb-3 text-secondary" />
            <p className="text-sm font-medium">Semantic Mesh is unavailable</p>
            <p className="text-xs text-secondary mt-2">
              This capability is not enabled for your current entitlements.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-[var(--border)] bg-[var(--bg-surface)] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-[var(--accent)]" />
          <span className="font-medium">Semantic Mesh</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {[
          { id: 'related', label: 'Related', icon: Link2 },
          { id: 'concepts', label: 'Concepts', icon: Sparkles },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-secondary hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {currentArticleTitle ? (
          <div className="space-y-2">
            {mockNodes
              .filter(n => 
                activeTab === 'related' ? n.type === 'article' : 
                activeTab === 'concepts' ? n.type === 'concept' || n.type === 'entity' :
                true
              )
              .map(node => (
                <button
                  key={node.id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors group"
                >
                  <div className={`
                    w-2 h-2 rounded-full flex-shrink-0
                    ${node.type === 'article' ? 'bg-blue-500' : 
                      node.type === 'concept' ? 'bg-purple-500' : 'bg-green-500'}
                  `} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{node.title}</p>
                    <p className="text-xs text-secondary capitalize">{node.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary">{Math.round(node.relevance * 100)}%</span>
                    <ChevronRight className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <Network className="w-12 h-12 mx-auto mb-3 text-secondary" />
              <p className="text-sm text-secondary">
                Open an article to see its semantic connections
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs text-secondary">
          <Sparkles className="w-3 h-3" />
          <span>AI-powered semantic analysis</span>
        </div>
      </div>
    </div>
  );
}
