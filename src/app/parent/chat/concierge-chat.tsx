"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Message } from "@/lib/types";

interface Props {
  childId: string;
  childName: string;
  conversationId: string;
  initialMessages: Message[];
  interests: string[];
}

const SUGGESTED_QUESTIONS = [
  "How's {name} doing socially?",
  "Activities for home tonight?",
  "What's the classroom working on?",
  "Tell me about {name}'s week",
];

export function ConciergeChat({
  childId,
  childName,
  conversationId,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const personalize = (text: string) =>
    text.replace(/\{name\}/g, childName);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Auto-resize textarea
  function handleInputChange(value: string) {
    setInputValue(value);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isTyping) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      role: "parent",
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);
    setError(null);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/parent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          childId,
          message: text.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const data = await res.json();
      setMessages((prev) => [...prev, data]);
    } catch {
      setError("Something went wrong. Try sending again.");
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  }

  return (
    <div className="h-dvh flex flex-col bg-cream">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-sand-dark px-4 py-3">
        <div className="mx-auto max-w-[640px] flex items-center gap-3">
          <Link
            href="/parent"
            className="text-warm-gray hover:text-espresso transition-colors"
          >
            {"\u2190"}
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rust to-[#47B3FF] flex items-center justify-center text-white text-sm font-bold">
              O
            </div>
            <div>
              <p className="text-espresso font-semibold text-sm leading-tight">
                Orbit
              </p>
              <p className="text-warm-gray text-xs">
                {childName}&apos;s concierge
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto orbit-scroll">
        <div className="mx-auto max-w-[640px] px-4 py-6 space-y-4">
          {/* Welcome message if no history */}
          {messages.length === 0 && (
            <div className="text-center py-8 fade-up">
              <div className="text-4xl mb-3">{"\u{1F30D}"}</div>
              <h2 className="font-[family-name:var(--font-playfair)] text-xl font-bold text-espresso mb-2">
                Ask me anything about {childName}
              </h2>
              <p className="text-warm-gray text-sm max-w-[320px] mx-auto">
                I know {childName}&apos;s observations, interests, classroom
                themes, and school info. How can I help?
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "parent" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "parent"
                    ? "bg-rust text-white rounded-br-md"
                    : "bg-white text-espresso shadow-sm rounded-bl-md"
                }`}
              >
                <p
                  className={`text-sm leading-relaxed whitespace-pre-line font-[family-name:var(--font-source-serif)]`}
                >
                  {msg.content}
                </p>
                <p
                  className={`text-[10px] mt-1.5 ${
                    msg.role === "parent"
                      ? "text-white/50"
                      : "text-warm-gray/50"
                  }`}
                >
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1.5 items-center h-5">
                  <span className="typing-dot w-2 h-2 rounded-full bg-warm-gray/40" />
                  <span
                    className="typing-dot w-2 h-2 rounded-full bg-warm-gray/40"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="typing-dot w-2 h-2 rounded-full bg-warm-gray/40"
                    style={{ animationDelay: "0.3s" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center">
              <p className="text-red-500 text-xs">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested Questions (show when no messages) */}
      {messages.length === 0 && (
        <div className="shrink-0 px-4 pb-2">
          <div className="mx-auto max-w-[640px] flex gap-2 overflow-x-auto orbit-scroll pb-1">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(personalize(q))}
                className="shrink-0 bg-white border border-sand-dark text-espresso text-xs px-3 py-2 rounded-full hover:bg-sand transition-colors whitespace-nowrap"
              >
                {personalize(q)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="shrink-0 border-t border-sand-dark bg-white px-4 py-3">
        <div className="mx-auto max-w-[640px] flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${childName}...`}
            rows={1}
            className="flex-1 bg-cream border border-sand-dark rounded-xl px-4 py-2.5 text-espresso text-sm placeholder:text-warm-gray/50 focus:outline-none focus:ring-2 focus:ring-rust/20 focus:border-rust/40 resize-none leading-relaxed font-[family-name:var(--font-source-serif)]"
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isTyping}
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              inputValue.trim() && !isTyping
                ? "bg-rust text-white hover:bg-rust/90"
                : "bg-sand-dark text-warm-gray/50"
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}
