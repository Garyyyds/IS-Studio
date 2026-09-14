import { TaggingRule, ITCategory } from '../types';

export function evaluateTaskPriorityWithRules(
  taskData: {
    title: string;
    description: string;
    rawLogs?: string;
    affectedUsersEstimate?: number;
  },
  rules: TaggingRule[]
): {
  automatedTags: string[];
  category: ITCategory;
} {
  const combinedText = `${taskData.title} ${taskData.description} ${taskData.rawLogs || ''}`.toLowerCase();

  const tagsSet = new Set<string>();
  let category: ITCategory = 'Others';

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
