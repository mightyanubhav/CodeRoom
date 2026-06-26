import { useState, useRef, useEffect } from 'react';
import { aiAPI } from '../../services/api.js';
import useRoomStore from '../../store/roomStore.js';

const QUICK_ACTIONS = [
    { label: '🔍 Evaluate Code',      message: 'Evaluate the candidate\'s current code. Is it correct? What is the time and space complexity?' },
    { label: '⚡ Optimal Approach?',   message: 'Is this the optimal approach? Are there better solutions available?' },
    { label: '🐛 Find Bugs',          message: 'Find any bugs, edge cases, or issues in the current code.' },
    { label: '💡 Suggest a Hint',     message: 'Suggest a non-spoiler hint I can give the candidate to nudge them in the right direction.' },
    { label: '📊 Rate Code 1-10',     message: 'Rate the code quality from 1-10 considering correctness, readability, and efficiency.' },
    { label: '❓ Follow-up Question', message: 'Generate a good follow-up question based on the candidate\'s current solution.' },
    { label: '📝 Pre-fill Scorecard', message: 'Based on what you have seen, pre-fill a scorecard with scores for problem solving, code quality, and communication. Give an overall hire/no-hire recommendation.' },
];

const AICopilotPanel = () => {
    const { currentCode, language, question } = useRoomStore();

    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: "Hi! I'm your AI copilot. I can see the candidate's code and the current question in real time. Use the quick actions or ask me anything.",
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (messageText) => {
        const text = messageText || input.trim();
        if (!text || isLoading) return;

        const userMessage = { role: 'user', content: text };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            // Build history — skip greeting, skip current message
            const history = newMessages
                .slice(1)
                .slice(0, -1)
                .map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.content,
                }));

            const response = await aiAPI.chat({
                question: question?.questionTitle || null,
                code: currentCode || '',
                language: language || 'JAVASCRIPT',
                message: text,
                history,
            });

            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: response.data.response }
            ]);
        } catch (err) {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: '❌ Failed to get AI response. Please try again.' }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#161b22]">

            {/* Header */}
            <div className="px-3 py-2 border-b border-[#30363d] flex items-center gap-2 shrink-0">
                <span className="text-sm">🤖</span>
                <span className="text-xs font-medium text-[#8b949e]">AI Copilot</span>
                <span className="ml-auto text-xs text-[#238636] bg-[#1a2f1a] px-1.5 py-0.5 rounded-full">
                    Gemini
                </span>
            </div>

            {/* Quick actions */}
            <div className="px-2 py-2 border-b border-[#30363d] shrink-0">
                <div className="flex flex-wrap gap-1">
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.label}
                            onClick={() => sendMessage(action.message)}
                            disabled={isLoading}
                            className="text-xs bg-[#21262d] hover:bg-[#30363d] disabled:opacity-50 text-[#8b949e] hover:text-white border border-[#30363d] px-2 py-1 rounded-lg transition-colors"
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                            msg.role === 'user'
                                ? 'bg-[#238636] text-white'
                                : 'bg-[#21262d] text-[#c9d1d9]'
                        }`}>
                            <MarkdownText text={msg.content} />
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-[#21262d] rounded-lg px-3 py-2">
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-[#8b949e] rounded-full animate-bounce"
                                    style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-[#8b949e] rounded-full animate-bounce"
                                    style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-[#8b949e] rounded-full animate-bounce"
                                    style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-2 border-t border-[#30363d] shrink-0">
                <div className="flex gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask AI about the interview..."
                        rows={2}
                        disabled={isLoading}
                        className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white placeholder-[#484f58] focus:outline-none focus:border-[#238636] resize-none disabled:opacity-50 transition-colors"
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={isLoading || !input.trim()}
                        className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white px-3 rounded-lg transition-colors text-xs font-medium shrink-0"
                    >
                        Send
                    </button>
                </div>
                <p className="text-xs text-[#484f58] mt-1">
                    Enter to send · Shift+Enter for new line
                </p>
            </div>
        </div>
    );
};

// ─── Simple markdown renderer ─────────────────────────────────────────────────
const MarkdownText = ({ text }) => {
    if (!text) return null;

    const lines = text.split('\n');

    return (
        <div className="space-y-1">
            {lines.map((line, i) => {
                if (line.startsWith('```')) return null;

                if (line.startsWith('### '))
                    return <p key={i} className="font-bold text-white text-xs">{line.slice(4)}</p>;
                if (line.startsWith('## '))
                    return <p key={i} className="font-bold text-white text-xs">{line.slice(3)}</p>;
                if (line.startsWith('# '))
                    return <p key={i} className="font-bold text-white text-xs">{line.slice(2)}</p>;

                if (line.startsWith('- ') || line.startsWith('* '))
                    return <p key={i} className="pl-2">• {formatInline(line.slice(2))}</p>;

                if (/^\d+\. /.test(line))
                    return <p key={i} className="pl-2">{formatInline(line)}</p>;

                if (!line.trim()) return <br key={i} />;

                return <p key={i}>{formatInline(line)}</p>;
            })}
        </div>
    );
};

const formatInline = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={i} className="text-white font-semibold">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code key={i} className="bg-[#0d1117] px-1 rounded text-[#58a6ff] font-mono">
                    {part.slice(1, -1)}
                </code>
            );
        }
        return part;
    });
};

export default AICopilotPanel;