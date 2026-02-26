"use client";

import { useState } from "react";
import { DomainPill } from "@/components/ui/domain-pill";
import type { JourneyChapter } from "@/lib/types";

interface Props {
  chapters: JourneyChapter[];
  childName: string;
}

export function GrowthTimeline({ chapters, childName }: Props) {
  // Default to the current chapter, or last one
  const currentId =
    chapters.find((c) => c.is_current)?.id ?? chapters[chapters.length - 1]?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(currentId);

  if (chapters.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-3xl mb-2">📖</p>
        <p className="text-warm-gray text-sm">
          No journey chapters yet for {childName}. They&apos;ll appear as observations build up.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📖</span>
        <span className="font-[family-name:var(--font-playfair)] text-lg font-bold text-espresso">
          The Chapters
        </span>
      </div>

      {chapters.map((ch, i) => {
        const isOpen = openId === ch.id;
        return (
          <div key={ch.id} className="relative">
            {/* Timeline connector line */}
            {i < chapters.length - 1 && (
              <div
                className="absolute left-[20px] top-[38px] bottom-[-4px] w-[2px] bg-sand-dark/40"
                style={{ zIndex: 0 }}
              />
            )}

            <div className="flex gap-3.5">
              {/* Timeline node */}
              <div className="shrink-0 w-[42px] pt-0.5 flex justify-center" style={{ zIndex: 1 }}>
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${
                    isOpen
                      ? "bg-gradient-to-br from-rust to-rust/70 shadow-md"
                      : "bg-white border-2 border-sand-dark"
                  }`}
                >
                  {ch.emoji}
                </div>
              </div>

              {/* Chapter card */}
              <div
                onClick={() => setOpenId(isOpen ? null : ch.id)}
                className={`flex-1 bg-white rounded-2xl cursor-pointer mb-3.5 transition-all ${
                  isOpen
                    ? "shadow-md border border-rust/15 p-5"
                    : "shadow-sm border border-sand p-3.5 hover:shadow-md"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[11px] font-bold text-rust">
                        {ch.period}
                      </span>
                      {ch.is_current && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sage/15 text-sage font-bold uppercase">
                          NOW
                        </span>
                      )}
                      {ch.age_label && (
                        <span className="text-[10px] text-warm-gray">
                          · {ch.age_label}
                        </span>
                      )}
                    </div>
                    <h3
                      className={`font-[family-name:var(--font-playfair)] font-semibold text-espresso leading-tight transition-all ${
                        isOpen ? "text-xl" : "text-base"
                      }`}
                    >
                      {ch.title}
                    </h3>
                  </div>
                  <span
                    className={`text-[11px] text-warm-gray transition-transform mt-1 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </div>

                {/* Collapsed: truncated summary */}
                {!isOpen && ch.summary && (
                  <p className="text-xs text-warm-gray mt-1.5 leading-relaxed line-clamp-2">
                    {ch.summary}
                  </p>
                )}

                {/* Expanded content */}
                {isOpen && (
                  <div className="mt-4 space-y-3">
                    {/* Full summary */}
                    {ch.summary && (
                      <p className="text-sm text-espresso leading-relaxed">
                        {ch.summary}
                      </p>
                    )}

                    {/* Highlight */}
                    {ch.highlight_text && (
                      <div className="bg-gradient-to-br from-rust/8 to-golden/8 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-base">
                            {ch.highlight_icon || "✨"}
                          </span>
                          <span className="text-[10px] font-bold text-rust uppercase tracking-wider">
                            Highlight
                          </span>
                        </div>
                        <p className="text-xs text-espresso leading-relaxed">
                          {ch.highlight_text}
                        </p>
                      </div>
                    )}

                    {/* Breakthrough */}
                    {ch.breakthrough_text && (
                      <div className="bg-sage/8 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-base">
                            {ch.breakthrough_icon || "💡"}
                          </span>
                          <span className="text-[10px] font-bold text-sage uppercase tracking-wider">
                            Breakthrough
                          </span>
                        </div>
                        <p className="text-xs text-espresso leading-relaxed">
                          {ch.breakthrough_text}
                        </p>
                      </div>
                    )}

                    {/* Emerging + Friends row */}
                    <div className="flex gap-4 flex-wrap">
                      {ch.emerging && ch.emerging.length > 0 && (
                        <div className="flex-1 min-w-[140px]">
                          <p className="text-[10px] font-bold text-warm-gray uppercase tracking-wider mb-1.5">
                            Emerging Skills
                          </p>
                          {ch.emerging.map((e) => (
                            <p key={e} className="text-xs text-espresso leading-relaxed">
                              · {e}
                            </p>
                          ))}
                        </div>
                      )}
                      {ch.friends && ch.friends.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-warm-gray uppercase tracking-wider mb-1.5">
                            Close Friends
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ch.friends.map((f) => (
                              <span
                                key={f}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-sky/10 text-sky font-medium"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Domain pills */}
                    {ch.top_domains && ch.top_domains.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {ch.top_domains.map((d) => (
                          <DomainPill key={d} domain={d} />
                        ))}
                      </div>
                    )}

                    {/* Parent note */}
                    {ch.parent_note && (
                      <div className="px-3.5 py-3 rounded-xl bg-cream border-l-3 border-rust">
                        <p className="text-[10px] font-bold text-rust uppercase tracking-wider mb-1">
                          A Note for You
                        </p>
                        <p className="text-xs text-warm-gray italic leading-relaxed">
                          {ch.parent_note}
                        </p>
                      </div>
                    )}

                    {/* Observation count */}
                    <p className="text-[11px] text-warm-gray text-center pt-1">
                      Based on {ch.observation_count} observations
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Looking Ahead CTA */}
      <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-rust/8 via-sand to-sage/8 border border-sand-dark/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🎓</span>
          <span className="font-[family-name:var(--font-playfair)] text-base font-semibold text-espresso">
            Looking Ahead
          </span>
        </div>
        <p className="text-xs text-espresso/80 leading-relaxed mb-2">
          {childName} has{" "}
          <strong>{chapters.length} chapters</strong> and{" "}
          <strong>
            {chapters.reduce((s, c) => s + (c.observation_count || 0), 0)} observations
          </strong>
          . This isn&apos;t a report card — it&apos;s a story only the teachers could tell.
        </p>
        <p className="text-[11px] text-warm-gray italic">
          When it&apos;s time for kindergarten, this entire journey becomes {childName}&apos;s
          readiness narrative.
        </p>
      </div>
    </div>
  );
}
