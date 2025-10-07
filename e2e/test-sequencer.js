// Custom test sequencer to run tests in a specific order
const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Define test order priority
    const priority = {
      'auth-flow': 1,
      'organization-setup': 2,
      'policy-management': 3,
      'control-implementation': 4,
      'evidence-collection': 5,
      'workflow-execution': 6,
      'reporting': 7,
      'audit-trail': 8,
      'cleanup': 99
    };

    return tests.sort((a, b) => {
      const aPriority = Object.keys(priority).find(key => a.path.includes(key));
      const bPriority = Object.keys(priority).find(key => b.path.includes(key));
      
      const aOrder = aPriority ? priority[aPriority] : 50;
      const bOrder = bPriority ? priority[bPriority] : 50;
      
      return aOrder - bOrder;
    });
  }
}

module.exports = CustomSequencer;