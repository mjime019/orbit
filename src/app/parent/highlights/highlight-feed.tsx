"use client";

import { useState } from "react";
import { DomainPill } from "@/components/ui/domain-pill";
import { SOCIAL_TAG_CONFIG, type Highlight } from "@/lib/types";

interface HighlightWithTeacher extends Highlight {
  profiles?: { name: string } | null;
}

interface Props {
  highlights: HighlightWithTeacher[];
  childName: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function HighlightFeed({ highlights, childName }: Props) {
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const toggleSave = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (highlights.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">✨</p>
        <p className="text-warm-gray text-sm">
          No highlights yet for {childName}. They&apos;ll appear here once teachers send them.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-warm-gray text-xs mb-4">
        {highlights.length} highlight{highlights.length !== 1 ? "s" : ""}
      </p>

      <div className="space-y-4">
        {highlights.map((h, i) => (
          <HighlightCard
            key={h.id}
            highlight={h}
            isSaved={saved.has(h.id)}
            onToggleSave={() => toggleSave(h.id)}
            delay={i}
          />
        ))}
      </div>
    </div>
  );
}

function HighlightCard({
  highlight: h,
  isSaved,
  onToggleSave,
  delay,
}: {
  highlight: HighlightWithTeacher;
  isSaved: boolean;
  onToggleSave: () => void;
  delay: number;
}) {
  const teacherName = h.profiles?.name ?? "Teacher";

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm overflow-hidden fade-up delay-${Math.min(delay + 1, 6)}`}
    >
      <div className="p-4">
        {/* Header: date + teacher */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-rust uppercase tracking-wide">
              {formatDate(h.created_at)}
            </span>
            <span className="text-sand-dark">·</span>
            <span className="text-[11px] text-warm-gray">
              {timeAgo(h.created_at)}
            </span>
          </div>
          <button
            onClick={onToggleSave}
            className={`text-xl transition-transform hover:scale-110 ${
              isSaved ? "drop-shadow-sm" : "opacity-40 hover:opacity-70"
            }`}
            aria-label={isSaved ? "Unsave" : "Save"}
          >
            {isSaved ? "\u2764\uFE0F" : "\u{1F90D}"}
          </button>
        </div>

        {/* Title */}
        {h.title && (
          <h3 className="font-[family-name:var(--font-playfair)] text-lg font-bold text-espresso leading-tight mb-2">
            {h.title}
          </h3>
        )}

        {/* Content */}
        <p className="text-sm text-espresso/85 leading-relaxed">
          {h.content}
        </p>

        {/* Summary if different from content */}
        {h.summary && h.summary !== h.content && (
          <p className="text-xs text-warm-gray mt-2 italic leading-relaxed">
            {h.summary}
          </p>
        )}

        {/* Domain pills + social tags */}
        {(h.domains?.length > 0 || h.social_tags?.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {h.domains?.map((d) => (
              <DomainPill key={d} domain={d} />
            ))}
            {h.social_tags?.map((tag) => {
              const cfg = SOCIAL_TAG_CONFIG[tag];
              if (!cfg) return null;
              return (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky/10 text-sky font-medium"
                >
                  {cfg.emoji} {cfg.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Teacher attribution */}
        <div className="mt-3 pt-3 border-t border-sand flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center text-[10px]">
            {teacherName.charAt(0)}
          </div>
          <span className="text-[11px] text-warm-gray">
            Shared by {teacherName}
          </span>
        </div>
      </div>
    </div>
  );
}
