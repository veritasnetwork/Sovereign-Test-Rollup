/**
 * Configuration for the Veritas simulation
 */

export const config = {
  // Rollup connection
  rollupUrl: "http://127.0.0.1:12346",
  
  // Simulation parameters
  simulationSpeed: 30000,        // Milliseconds between rounds (30 seconds)
  agentsPerRound: { min: 1, max: 3 },     // Random range for new agents
  submissionsPerAgent: { min: 1, max: 3 }, // Random submissions per agent
  
  // Agent parameters
  stakeRange: { min: 100, max: 5000 },    // Token range for new agents
  
  // Belief submission strategies
  beliefStrategies: {
    contrarian: 0.1,    // 10% submit outlier values
    follower: 0.6,      // 60% follow current consensus
    random: 0.3         // 30% submit random values
  },
  
  // Initial beliefs to create
  initialBeliefs: [
    { question: "Will ETH exceed $5000 by end of 2024?", initialValue: 0.5 },
    { question: "Will Bitcoin hit $100,000 in 2024?", initialValue: 0.4 },
    { question: "Will there be a US Fed rate cut in Q1 2025?", initialValue: 0.6 },
    { question: "Will AI regulation pass in EU by mid-2025?", initialValue: 0.7 },
    { question: "Will SpaceX complete Mars mission by 2030?", initialValue: 0.3 }
  ],
  
  // Display settings
  display: {
    clearScreen: true,
    showDetailedLogs: false,
    maxRecentActivity: 10
  },
  
  // Pre-funded private keys for initial agents
  // These should have tokens in genesis.json
  fundedPrivateKeys: [
    "0d87c12ea7c12024b3f70a26d735874608f17c8bce2b48e6fe87389310191264", // Has tokens in genesis
  ]
};

export type SimConfig = typeof config;