// Example client code for interacting with Veritas modules
// This demonstrates how to use the modules once the rollup is running

// Example transactions for the Veritas modules:

// 1. Register as an agent with initial stake
const registerAgent = {
  veritas_agent: {
    register_agent: {
      initial_stake: 1000
    }
  }
};

// 2. Add more stake to your agent account
const addStake = {
  veritas_agent: {
    add_stake: {
      amount: 500
    }
  }
};

// 3. Submit a belief (prediction) - value is 0-100 (percentage * 100)
const submitBelief = {
  veritas_submission: {
    submit_belief: {
      belief_id: 1,
      value: 75  // 75% probability
    }
  }
};

// Example REST API queries:

// Get agent information
// GET http://localhost:12346/modules/veritas-agent/state/agents/{address}

// Get belief state
// GET http://localhost:12346/modules/veritas-belief/state/beliefs/{belief_id}

// Get all submissions for a belief
// Via RPC: veritas_submission.get_submissions(belief_id)

console.log("Example Veritas Module Usage:");
console.log("1. Register Agent:", JSON.stringify(registerAgent, null, 2));
console.log("2. Add Stake:", JSON.stringify(addStake, null, 2));
console.log("3. Submit Belief:", JSON.stringify(submitBelief, null, 2));

console.log("\nWorkflow:");
console.log("1. Alice registers with 1000 stake (weight: 100,000)");
console.log("2. Bob registers with 500 stake (weight: 50,000)");
console.log("3. Carol registers with 2000 stake (weight: 200,000)");
console.log("4. Alice submits belief: 70% probability");
console.log("5. Bob submits belief: 60% probability");
console.log("6. Carol submits belief: 65% probability");
console.log("7. Final aggregate converges based on weighted average");
console.log("8. Agents closer to consensus earn higher scores");