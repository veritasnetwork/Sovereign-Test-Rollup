/**
 * Type definitions for Veritas simulation
 */

// Runtime call types for Veritas modules
export interface RuntimeCall {
  veritas_agent?: {
    register_agent?: { initial_stake: number };
    add_stake?: { amount: number };
    withdraw_stake?: { amount: number };
  };
  veritas_belief?: {
    // Note: create_belief was removed from CallMessage in our implementation
    // We'll need to handle belief creation differently or add it back
    update_aggregate?: { belief_id: number; value: number; weight: number };
  };
  veritas_submission?: {
    submit_belief?: { belief_id: number; value: number }; // value is 0-100
  };
  bank?: any; // For token operations if needed
}

// Agent data structure
export interface Agent {
  address: string;
  privateKey: string;
  stake: number;
  score: number;
  submissions: number;
}

// Belief data structure
export interface Belief {
  id: number;
  question: string;
  aggregate: number;
  totalWeight: number;
  submissionCount: number;
}

// Submission record
export interface Submission {
  agent: string;
  beliefId: number;
  value: number;
  weight: number;
  timestamp: number;
}

// Simulation statistics
export interface SimulationStats {
  totalAgents: number;
  totalSubmissions: number;
  roundsCompleted: number;
  startTime: Date;
  beliefs: Map<number, BeliefStats>;
}

export interface BeliefStats {
  beliefId: number;
  question: string;
  currentAggregate: number;
  previousAggregate: number;
  totalSubmissions: number;
  convergenceRate: number; // How fast it's converging
  volatility: number; // How much it's changing
}

// API Response types
export interface AgentResponse {
  value: {
    stake: number;
    score: number;
  };
}

export interface BeliefResponse {
  value: {
    id: number;
    question: string;
    aggregate: number;
    total_weight: number;
  };
}

export interface TransactionResponse {
  response: {
    id: string;
    events: any[];
    receipt: {
      result: string;
      data: any;
    };
    tx_number: number;
    status: string;
  };
}