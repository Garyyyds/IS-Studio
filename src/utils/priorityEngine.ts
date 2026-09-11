import { TaggingRule, PriorityLevel, ITCategory, EnvironmentType } from '../types';

export function evaluateTaskPriorityWithRules(
  taskData: {
    title: string;
    description: string;
    rawLogs?: string;
    environment: EnvironmentType;
    affectedUsersEstimate?: number;
  },
  rules: TaggingRule[]
): {
  priority: PriorityLevel;
  automatedTags: string[];
  priorityRationale: string;
  category: ITCategory;
  impactScore: number;
  urgencyScore: number;
} {
  const combinedText = `${taskData.title} ${taskData.description} ${taskData.rawLogs || ''}`.toLowerCase();
  
  let selectedPriority: PriorityLevel = 'P3';
  let maxSeverityWeight = 2; // P3 = 2, P2 = 3, P1 = 4, P4 = 1
  let rationale = 'Evaluated using default IT triage criteria.';
  const tagsSet = new Set<string>();
  let category: ITCategory = 'DevOps & SRE';
  let impactScore = 5;
  let urgencyScore = 5;

  // Priority weights
  const priorityWeights: Record<PriorityLevel, number> = {
    P1: 4,
    P2: 3,
    P3: 2,
    P4: 1,
  };

  // Add environment tag
  if (taskData.environment === 'Production') {
    tagsSet.add('prod');
    impactScore = Math.max(impactScore, 7);
  } else if (taskData.environment === 'Staging') {
    tagsSet.add('staging');
  }

  // Iterate enabled rules
  for (const rule of rules.filter(r => r.enabled)) {
    let matched = false;

    if (rule.matchType === 'keyword') {
      const keywords = rule.pattern.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      for (const kw of keywords) {
        if (combinedText.includes(kw)) {
          matched = true;
          break;
        }
      }
    } else if (rule.matchType === 'regex') {
      try {
        const re = new RegExp(rule.pattern, 'i');
        if (re.test(combinedText)) {
          matched = true;
        }
      } catch (e) {
        console.error('Invalid regex in rule:', rule.pattern);
      }
    } else if (rule.matchType === 'environment') {
      if (taskData.environment.toLowerCase() === rule.pattern.toLowerCase()) {
        matched = true;
      }
    }

    if (matched) {
      // Add all rule tags
      rule.tagsToApply.forEach(tag => tagsSet.add(tag));
      
      const currentWeight = priorityWeights[rule.targetPriority];
      if (currentWeight > maxSeverityWeight || (rule.targetPriority === 'P4' && maxSeverityWeight <= 2 && taskData.environment === 'Staging')) {
        maxSeverityWeight = currentWeight;
        selectedPriority = rule.targetPriority;
        rationale = `Matched automated rule "${rule.name}" based on error pattern or severity indicators.`;
        if (rule.category) {
          category = rule.category;
        }
      }
    }
  }

  // Score adjustments
  if (selectedPriority === 'P1') {
    impactScore = Math.max(impactScore, 9);
    urgencyScore = Math.max(urgencyScore, 9);
  } else if (selectedPriority === 'P2') {
    impactScore = Math.max(impactScore, 7);
    urgencyScore = Math.max(urgencyScore, 7);
  } else if (selectedPriority === 'P4') {
    impactScore = Math.min(impactScore, 3);
    urgencyScore = Math.min(urgencyScore, 3);
  }

  // User impact count bonus
  if (taskData.affectedUsersEstimate && taskData.affectedUsersEstimate > 5000) {
    tagsSet.add('high-user-impact');
    if (selectedPriority !== 'P1') {
      selectedPriority = 'P2';
      rationale += ` Elevated to P2 due to high customer blast radius (${taskData.affectedUsersEstimate.toLocaleString()} affected users).`;
    }
  }

  return {
    priority: selectedPriority,
    automatedTags: Array.from(tagsSet),
    priorityRationale: rationale,
    category,
    impactScore,
    urgencyScore,
  };
}
