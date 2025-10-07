'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Trash2, Database, Send } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    context?: any;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [useMemory, setUseMemory] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: input,
                    conversationHistory: messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    useMemory,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();
            const assistantMessage: Message = {
                role: 'assistant',
                content: data.response || 'No response',
                context: data.context,
            };
            setMessages((prev) => [...prev, assistantMessage]);

            // Refresh stats
            await fetchStats();
        } catch (error) {
            console.error('Error:', error);
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Sorry, something went wrong.' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const clearMemory = async () => {
        if (!confirm('Are you sure you want to clear all memories?')) return;

        try {
            const response = await fetch('/api/memory', { method: 'DELETE' });
            if (response.ok) {
                alert('Memory cleared successfully!');
                await fetchStats();
            }
        } catch (error) {
            console.error('Error clearing memory:', error);
            alert('Failed to clear memory');
        }
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-slate-700">
            {/* Header with Stats */}
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <MessageSquare className="w-6 h-6 text-purple-400" />
                    <h2 className="text-xl font-bold text-white">AI Chat with Memory</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                        <Database className="w-4 h-4 text-blue-400" />
                        <span className="text-slate-300">
              {stats?.result?.vectors_count || 0} memories
            </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={useMemory}
                            onChange={(e) => setUseMemory(e.target.checked)}
                            className="w-4 h-4 rounded accent-purple-600"
                        />
                        <span className="text-sm text-slate-300">Use Memory</span>
                    </label>
                    <button
                        onClick={clearMemory}
                        className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
                        title="Clear Memory"
                    >
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="h-[500px] overflow-y-auto mb-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800">
                {messages.length === 0 && (
                    <div className="text-center text-slate-400 py-20">
                        <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>Start a conversation...</p>
                        <p className="text-sm mt-2">
                            {useMemory
                                ? "Memory is enabled - I'll remember our conversation!"
                                : 'Memory is disabled'}
                        </p>
                    </div>
                )}

                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`flex ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                    >
                        <div
                            className={`max-w-[75%] p-4 rounded-2xl ${
                                message.role === 'user'
                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-100'
                            }`}
                        >
                            <p className="whitespace-pre-wrap">{message.content}</p>

                            {/* Show context if available */}
                            {message.context &&
                                message.context.relevant_memories &&
                                message.context.relevant_memories.length > 0 && (
                                    <details className="mt-3 text-xs opacity-75">
                                        <summary className="cursor-pointer hover:opacity-100">
                                            📚 Used {message.context.relevant_memories.length} memories
                                        </summary>
                                        <div className="mt-2 space-y-1">
                                            {message.context.relevant_memories
                                                .slice(0, 3)
                                                .map((mem: any, i: number) => (
                                                    <div key={i} className="p-2 bg-black/20 rounded">
                                                        <div className="flex justify-between mb-1">
                                                            <span className="font-semibold">{mem.type}</span>
                                                            <span>Score: {(mem.score * 100).toFixed(0)}%</span>
                                                        </div>
                                                        <p className="truncate">{mem.content}</p>
                                                    </div>
                                                ))}
                                        </div>
                                    </details>
                                )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-700 p-4 rounded-2xl">
                            <div className="flex space-x-2">
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce-delay-100"></div>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce-delay-200"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 p-4 bg-slate-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400"
                    disabled={loading}
                />
                <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all transform hover:scale-105 flex items-center gap-2"
                >
                    <Send className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
