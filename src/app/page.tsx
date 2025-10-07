'use client';

import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import ImageUpload from '@/components/ImageUpload';
import VideoUpload from '@/components/VideoUpload';
import AudioUpload from '@/components/AudioUpload';
import { MessageSquare, Image, Video, Mic, Sparkles } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'image' | 'video' | 'audio'>('chat');

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare, color: 'from-purple-600 to-blue-600' },
    { id: 'image' as const, label: 'Image', icon: Image, color: 'from-blue-600 to-cyan-600' },
    { id: 'video' as const, label: 'Video', icon: Video, color: 'from-purple-600 to-pink-600' },
    { id: 'audio' as const, label: 'Audio', icon: Mic, color: 'from-green-600 to-teal-600' },
  ];

  return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-48 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 py-8 relative z-10">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sparkles className="w-12 h-12 text-yellow-400 animate-pulse" />
              <h1 className="text-6xl font-bold text-white">
                Multimodal AI Assistant
              </h1>
              <Sparkles className="w-12 h-12 text-yellow-400 animate-pulse" />
            </div>
            <p className="text-xl text-purple-200 mb-2">
              Powered by Llama 4 Scout & Cloudflare Workers AI
            </p>
            <p className="text-sm text-purple-300">
              🎯 Text • 🖼️ Image • 📹 Video • 🎵 Audio Analysis with Vector Memory
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center gap-4 mb-8 flex-wrap">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                  <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                          activeTab === tab.id
                              ? `bg-gradient-to-r ${tab.color} text-white shadow-2xl shadow-purple-500/50`
                              : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 backdrop-blur-sm border border-slate-700'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </div>
                    {activeTab === tab.id && (
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1/2 h-1 bg-white rounded-full"></div>
                    )}
                  </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="max-w-5xl mx-auto">
            <div className="transition-all duration-300 ease-in-out">
              {activeTab === 'chat' && <ChatInterface />}
              {activeTab === 'image' && <ImageUpload />}
              {activeTab === 'video' && <VideoUpload />}
              {activeTab === 'audio' && <AudioUpload />}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 text-purple-300 text-sm">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <p>Built with Next.js, Cloudflare Workers AI, and Llama 4 Scout</p>
            </div>
            <p className="text-purple-400">
              ⚡ Edge Computing • 🧠 Vector Memory • 🚀 Multimodal Intelligence
            </p>
          </div>
        </div>

        {/* Floating Particles Effect (Optional) */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-20 left-20 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
          <div className="absolute top-40 right-40 w-2 h-2 bg-blue-400 rounded-full animate-ping delay-75"></div>
          <div className="absolute bottom-40 left-60 w-2 h-2 bg-pink-400 rounded-full animate-ping delay-150"></div>
          <div className="absolute bottom-20 right-20 w-2 h-2 bg-green-400 rounded-full animate-ping delay-300"></div>
        </div>
      </main>
  );
}
