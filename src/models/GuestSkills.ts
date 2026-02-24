export interface GuestSkills {
  strength: number;    // 0-100, affects power deviation
  accuracy: number;    // 0-100, affects angle deviation
  driver: number;      // 0-100, club-specific skill
  wood: number;
  iron: number;
  sandWedge: number;
  putter: number;
  leftSpin: number;    // 0-100, left-spin control ability
  rightSpin: number;   // 0-100, right-spin control ability
}

const TIER_AVERAGES: Record<string, number> = {
  bad: 30,
  average: 40,
  good: 60,
  pro: 80,
};

function randomSkillValue(base: number): number {
  const value = base + (Math.random() - 0.5) * 20; // ±10
  return Math.round(Math.max(0, Math.min(100, value)));
}

export type SkillTier = 'bad' | 'average' | 'good' | 'pro';

export function generateGuestSkills(tier: SkillTier): GuestSkills {
  const base = TIER_AVERAGES[tier];
  return {
    strength: randomSkillValue(base),
    accuracy: randomSkillValue(base),
    driver: randomSkillValue(base),
    wood: randomSkillValue(base),
    iron: randomSkillValue(base),
    sandWedge: randomSkillValue(base),
    putter: randomSkillValue(base),
    leftSpin: randomSkillValue(base),
    rightSpin: randomSkillValue(base),
  };
}

const SKILL_TIERS: SkillTier[] = ['bad', 'average', 'good', 'pro'];

export function randomSkillTier(): SkillTier {
  return SKILL_TIERS[Math.floor(Math.random() * SKILL_TIERS.length)];
}
