import { TaggingRule, ITCategory, EnvironmentType } from '../types';

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
  automatedTags: string[];
  category: ITCategory;
} {
  const combinedText = `${taskData.title} ${taskData.description} ${taskData.rawLogs || ''}`.toLowerCase();

  const tagsSet = new Set<string>();
  let category: ITCategory = 'DevOps & SRE';

  // Add environment tag
  if (taskData.environment === 'Production') {
    tagsSet.add('prod');
  } else if (taskData.environment === 'Staging') {
    tagsSet.add('staging');
  }

  // Iterate enabled rules. The last matching rule that carries a category wins,
  // since rules are listed in the order the operator wants them applied.
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
      rule.tagsToApply.forEach(tag => tagsSet.add(tag));
      if (rule.category) {
        category = rule.category;
      }
    }
  }

  // Flag a wide blast radius as a tag rather than a severity score.
  if (taskData.affectedUsersEstimate && taskData.affectedUsersEstimate > 5000) {
    tagsSet.add('high-user-impact');
  }

  return {
    automatedTags: Array.from(tagsSet),
    category,
  };
}
