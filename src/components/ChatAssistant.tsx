"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";

interface ChatAssistantProps {
  householdId: string;
  userId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatAssistant({ householdId, userId }: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hey! I'm your CreelSync assistant. Ask me anything about the schedule, the app, or how to get things done." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          household_id: householdId,
          user_id: userId,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Try again." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 w-12 h-12 bg-[var(--color-primary)] text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-50"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col" style={{ height: "70vh", maxHeight: "600px" }}>
      {/* Backdrop */}
      <div className="absolute inset-0 -top-[100vh] bg-black/30" onClick={() => setOpen(false)} />

      {/* Chat panel */}
      <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col flex-1 mx-0 sm:mx-auto sm:max-w-lg sm:mb-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold">CreelSync Assistant</p>
              <p className="text-[10px] text-green-500 font-medium">Online</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[var(--color-primary)] text-white rounded-br-md"
                    : "bg-gray-100 text-[var(--color-text)] rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-md">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-[var(--color-border)] bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder="Ask about schedule, conflicts, app help..."
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="w-10 h-10 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center disabled:opacity-50 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
