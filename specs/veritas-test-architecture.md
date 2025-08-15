# Veritas Test Architecture Specification

## Overview

This document specifies a simplified version of the Veritas protocol designed for learning Sovereign SDK module development. This "Veritas Lite" implementation strips away temporal complexity, privacy mechanisms, and advanced game theory to focus on the core belief aggregation mechanism.

## Purpose

- Learn Sovereign SDK module patterns
- Implement basic weighted belief aggregation
- Establish foundation for incremental complexity
- Test inter-module communication

## Core Components

### Data Structures

```rust
// Agent - represents a participant with stake and reputation
pub struct Agent {
    pub address: Address,
    pub stake: u64,        // Amount staked
    pub score: u64,        // Reputation score (starts at 100)
}

// Belief - represents a prediction market/question
pub struct Belief {
    pub id: BeliefId,
    pub question: String,
    pub aggregate: f64,    // Current consensus (0.0 to 1.0)
    pub total_weight: u64, // Sum of all weights contributed
}

// Submission - records an agent's belief submission
pub struct Submission {
    pub agent: Address,
    pub belief_id: BeliefId,
    pub value: f64,        // Agent's belief (0.0 to 1.0)
    pub weight: u64,       // Stake × Score at submission time
    pub timestamp: u64,    // Block timestamp
}
```

## Module Architecture

### Module 1: AgentModule

**Purpose**: Manages agent registration, stake, and scores

**State Variables**:
```rust
agents: StateMap<Address, Agent>  // All registered agents
```

**Call Methods**:
```rust
#[call]
pub fn register_agent(&mut self, initial_stake: u64) -> Result<()>
// Creates new agent with default score of 100

#[call]
pub fn add_stake(&mut self, amount: u64) -> Result<()>
// Increases calling agent's stake

#[call]
pub fn withdraw_stake(&mut self, amount: u64) -> Result<()>
// Decreases calling agent's stake (must have sufficient balance)
```

**Internal Methods**:
```rust
pub fn get_weight(&self, address: Address) -> Result<u64>
// Returns stake × score for an agent

pub fn update_score(&mut self, address: Address, delta: u64) -> Result<()>
// Adds delta to agent's score (called by SubmissionModule)
```

### Module 2: BeliefModule

**Purpose**: Manages beliefs and their aggregated values

**State Variables**:
```rust
beliefs: StateMap<BeliefId, Belief>  // All beliefs
next_belief_id: u64                  // Counter for generating IDs
```

**Call Methods**:
```rust
#[call]
pub fn create_belief(&mut self, question: String, initial_value: f64) -> Result<BeliefId>
// Creates new belief with initial aggregate value

#[call]
pub fn get_belief_state(&self, belief_id: BeliefId) -> Result<BeliefState>
// Returns current aggregate and metadata for a belief
```

**Internal Methods**:
```rust
pub fn update_aggregate(&mut self, belief_id: BeliefId, value: f64, weight: u64) -> Result<f64>
// Updates belief aggregate with new weighted value, returns new aggregate
```

### Module 3: SubmissionModule

**Purpose**: Orchestrates belief submissions and scoring

**State Variables**:
```rust
submissions: StateVec<Submission>  // Historical record of all submissions
```

**Call Methods**:
```rust
#[call]
pub fn submit_belief(&mut self, belief_id: BeliefId, value: f64) -> Result<()>
// Main entry point for agents to submit beliefs

#[call]
pub fn get_submissions(&self, belief_id: BeliefId) -> Result<Vec<Submission>>
// Returns all submissions for a specific belief
```

## Aggregation and Scoring Rules

### Weighted Average Aggregation

When an agent submits a belief, the aggregate updates using a simple weighted average:

```rust
new_aggregate = (old_aggregate * old_total_weight + submission_value * agent_weight) 
                / (old_total_weight + agent_weight)

where:
    agent_weight = agent.stake * agent.score
```

### Simple Distance-Based Scoring

After aggregation, the submitting agent receives a score update based on how close their submission was to the new aggregate:

```rust
distance = |submission_value - new_aggregate|
score_delta = 100 / (1 + (distance * 100))
agent.score += score_delta
```

Agents closer to consensus earn more points, incentivizing coordination.

## Transaction Flow

### Complete Submission Process

1. **Agent Registration**
   ```javascript
   agent_module.register_agent({ initial_stake: 1000 })
   ```

2. **Belief Creation**
   ```javascript
   belief_module.create_belief({ 
       question: "Will ETH exceed $5000 by Dec 2024?",
       initial_value: 0.5 
   })
   ```

3. **Belief Submission**
   ```javascript
   submission_module.submit_belief({ 
       belief_id: 1, 
       value: 0.75 
   })
   ```

### Internal Execution Flow

When `submit_belief` is called:

```
1. Get sender's address from context
2. Call AgentModule.get_weight(sender) → weight
3. Call BeliefModule.update_aggregate(belief_id, value, weight) → new_aggregate  
4. Calculate distance and score_delta
5. Call AgentModule.update_score(sender, score_delta)
6. Store submission record with timestamp
```

## What's Included vs Excluded

### Included (Simplified Core)
- ✅ Agent management with stake
- ✅ Belief creation and state
- ✅ Weighted aggregation
- ✅ Simple scoring mechanism
- ✅ Submission history

### Excluded (For Future Iterations)
- ❌ Epochs and temporal dynamics
- ❌ Commit/reveal privacy
- ❌ BTS (Bayesian Truth Serum) scoring
- ❌ Trust evolution and memory
- ❌ Mirror descent updates
- ❌ Entropy calculations
- ❌ Zero-sum redistribution
- ❌ Revenue models
- ❌ Delegation mechanics
- ❌ Meta-beliefs
- ❌ Multiple outcome types (only binary for now)

## Implementation Notes

### Module Communication
- SubmissionModule acts as the orchestrator
- AgentModule and BeliefModule provide internal methods
- Cross-module calls use dependency injection or module references

### Storage Patterns
- Use `StateMap` for key-value lookups (agents, beliefs)
- Use `StateVec` for append-only lists (submissions)
- All state changes are atomic within transactions

### Error Handling
- Check agent exists before submission
- Verify belief exists before submission
- Validate stake sufficiency for withdrawals
- Ensure values are in [0.0, 1.0] range

## Next Steps for Incremental Complexity

Once this basic version works, add complexity in stages:

1. **Stage 2**: Multiple outcomes (discrete distributions instead of binary)
2. **Stage 3**: Epochs with batch processing
3. **Stage 4**: Commit/reveal mechanism for privacy
4. **Stage 5**: Proper BTS scoring with meta-predictions
5. **Stage 6**: Trust dynamics with memory
6. **Stage 7**: Mirror descent for passive updates
8. **Stage 8**: Zero-sum stake redistribution
9. **Stage 9**: Revenue layer with different models
10. **Stage 10**: Delegation and meta-beliefs

## Success Criteria

This test implementation succeeds if it can:
1. Register multiple agents with different stakes
2. Create multiple beliefs
3. Accept submissions that update aggregates
4. Show convergence toward consensus over time
5. Reward agents who submit values close to consensus
6. Query current belief states and submission history

## Example Usage Scenario

```javascript
// Three agents register
alice.register_agent(1000)  // stake: 1000, score: 100
bob.register_agent(500)     // stake: 500, score: 100  
carol.register_agent(2000)  // stake: 2000, score: 100

// Create a belief
belief_id = create_belief("Will it rain tomorrow?", 0.5)

// Agents submit their beliefs
alice.submit_belief(belief_id, 0.7)  // weight: 100,000
// New aggregate: (0.5 * 0 + 0.7 * 100,000) / 100,000 = 0.7

bob.submit_belief(belief_id, 0.6)    // weight: 50,000  
// New aggregate: (0.7 * 100,000 + 0.6 * 50,000) / 150,000 = 0.667

carol.submit_belief(belief_id, 0.65) // weight: 200,000
// New aggregate: (0.667 * 150,000 + 0.65 * 200,000) / 350,000 = 0.657

// Scores update based on distance from final aggregate
// Carol gets highest score boost (closest to 0.657)
```