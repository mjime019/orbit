// The Child Memory Layer, rendered: the About tab's file view. Deterministic
// section order from SECTION_ORDER; extra keys render through the registry
// (unknown ones under "Anything Else") — never as raw JSON.

import {
  EXTRA_REGISTRY,
  FAMILY_KEYS,
  SECTION_ORDER,
  displayPills,
  displayValue,
  titleCaseKey,
  type SectionKey,
} from "@/lib/extra-registry";

function Pills({ items, color = "bg-sand text-warm-gray" }: { items: string[]; color?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${color}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-warm-gray uppercase tracking-wide mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  return <p className="text-xs text-espresso/80 leading-relaxed">{text}</p>;
}

function Quotes({ items }: { items: string[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((q) => (
        <p key={q} className="text-xs text-espresso/80 italic leading-relaxed">
          &ldquo;{q.replace(/^["“]|["”]$/g, "")}&rdquo;
        </p>
      ))}
    </div>
  );
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{emoji}</span>
        <h3 className="text-[11px] font-bold text-espresso uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// Render one extra-registry value by its declared renderer. Returns null for
// empty values so empty sections disappear.
function renderExtraValue(
  keyName: string,
  value: unknown,
  spec: { label: string; render: "pills" | "paragraph" | "quotes" },
  pillColor: string
): React.ReactNode | null {
  if (spec.render === "pills" || spec.render === "quotes") {
    const items = displayPills(value);
    if (items.length === 0) return null;
    return (
      <Labeled key={keyName} label={spec.label}>
        {spec.render === "quotes" ? <Quotes items={items} /> : <Pills items={items} color={pillColor} />}
      </Labeled>
    );
  }
  const text = displayValue(value);
  if (!text) return null;
  return (
    <Labeled key={keyName} label={spec.label}>
      <Paragraph text={text} />
    </Labeled>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function ProfileSections({ profile }: { profile: any }) {
  const extra: Record<string, unknown> = profile?.extra ?? {};

  // extra keys grouped by their registry section; unknowns go to "other".
  const extraBySection = new Map<SectionKey, React.ReactNode[]>();
  for (const [key, value] of Object.entries(extra)) {
    const spec = EXTRA_REGISTRY[key] ?? {
      label: titleCaseKey(key),
      section: "other" as SectionKey,
      render: Array.isArray(value) ? ("pills" as const) : ("paragraph" as const),
    };
    const node = renderExtraValue(key, value, spec, "bg-sand text-warm-gray");
    if (node) {
      const list = extraBySection.get(spec.section) ?? [];
      list.push(node);
      extraBySection.set(spec.section, list);
    }
  }
  const extrasFor = (section: SectionKey) => extraBySection.get(section) ?? [];

  // Family: the family_context column and family-keyed extras render
  // together, so pre-fix rows (family data still in extra) display fine.
  const familyContext: Record<string, unknown> = profile?.family_context ?? {};
  const familyNodes: React.ReactNode[] = [];
  for (const [key, value] of Object.entries(familyContext)) {
    const spec = EXTRA_REGISTRY[key] ?? {
      label: titleCaseKey(key),
      section: "family" as SectionKey,
      render: Array.isArray(value) ? ("pills" as const) : ("paragraph" as const),
    };
    // Skip if the same key also sits in extra (already rendered there).
    if (FAMILY_KEYS.has(key) && extra[key] !== undefined) continue;
    const node = renderExtraValue(`fc_${key}`, value, spec, "bg-sand text-warm-gray");
    if (node) familyNodes.push(node);
  }

  const routines: Record<string, unknown> = profile?.routines ?? {};
  const routineNodes = Object.entries(routines)
    .map(([key, value]) => {
      const text = displayValue(value);
      if (!text) return null;
      return (
        <Labeled key={key} label={titleCaseKey(key)}>
          <Paragraph text={text} />
        </Labeled>
      );
    })
    .filter(Boolean);

  const parentValues = displayPills(profile?.parent_values);

  const sectionContent: Record<SectionKey, React.ReactNode[]> = {
    temperament: extrasFor("temperament"),
    interests: [
      profile?.interests?.length ? (
        <Pills key="interests" items={profile.interests} color="bg-golden/15 text-golden" />
      ) : null,
      profile?.emerging_interests?.length ? (
        <Labeled key="emerging" label="Emerging">
          <Pills items={profile.emerging_interests} color="bg-sky/10 text-sky" />
        </Labeled>
      ) : null,
      profile?.play_style ? (
        <Labeled key="play" label="How he plays">
          <p className="text-sm text-espresso font-medium">
            {displayValue(profile.play_style)}
          </p>
          {profile.play_style_notes && (
            <p className="text-xs text-warm-gray mt-1 leading-relaxed">
              {displayValue(profile.play_style_notes)}
            </p>
          )}
        </Labeled>
      ) : null,
      ...extrasFor("interests"),
    ].filter(Boolean),
    school: extrasFor("school"),
    growing: extrasFor("growing"),
    sensitivities: [
      profile?.food_sensitivities?.length ? (
        <Labeled key="food" label="Food">
          <Pills items={profile.food_sensitivities} color="bg-red-50 text-red-700" />
        </Labeled>
      ) : null,
      profile?.sensory_sensitivities?.length ? (
        <Labeled key="sensory" label="Sensory">
          <Pills items={profile.sensory_sensitivities} color="bg-orange-50 text-orange-700" />
        </Labeled>
      ) : null,
      profile?.emotional_triggers?.length ? (
        <Labeled key="emotional" label="Emotional Triggers">
          <Pills items={profile.emotional_triggers} color="bg-purple-50 text-purple-700" />
        </Labeled>
      ) : null,
      ...extrasFor("sensitivities"),
    ].filter(Boolean),
    comfort: [
      profile?.comfort_helps?.length ? (
        <Labeled key="helps" label="What helps">
          <Pills items={profile.comfort_helps} color="bg-sage/10 text-sage" />
        </Labeled>
      ) : null,
      profile?.comfort_escalates?.length ? (
        <Labeled key="escalates" label="What escalates">
          <Pills items={profile.comfort_escalates} color="bg-rust/10 text-rust" />
        </Labeled>
      ) : null,
      ...extrasFor("comfort"),
    ].filter(Boolean),
    routines: [...routineNodes, ...extrasFor("routines")],
    family: [...familyNodes, ...extrasFor("family")],
    goals: [
      profile?.parent_goals?.length ? (
        <ul key="goals" className="space-y-2">
          {profile.parent_goals.map((goal: string, i: number) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-sage text-xs mt-0.5">●</span>
              <span className="text-xs text-espresso/80 leading-relaxed">{goal}</span>
            </li>
          ))}
        </ul>
      ) : null,
      ...extrasFor("goals"),
    ].filter(Boolean),
    values: [
      parentValues.length ? (
        <Labeled key="values" label="What matters most">
          <Pills items={parentValues} color="bg-lavender/30 text-espresso" />
        </Labeled>
      ) : null,
      ...extrasFor("values"),
    ].filter(Boolean),
    other: extrasFor("other"),
  };

  const visible = SECTION_ORDER.filter((s) => sectionContent[s.key].length > 0);

  if (visible.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <p className="text-3xl mb-2">🌱</p>
        <p className="text-sm text-espresso font-medium mb-1">Nothing in the file yet</p>
        <p className="text-xs text-warm-gray">
          Seed the file — a few questions bring out what makes him him.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visible.map((s) => (
        <Section key={s.key} emoji={s.emoji} title={s.title}>
          {sectionContent[s.key]}
        </Section>
      ))}
    </div>
  );
}
