# Veritas Implementation Guide

## Overview
This guide documents all the files created/modified to implement the Veritas belief aggregation system on Sovereign SDK. The implementation follows the architecture specified in `/specs/veritas-test-architecture.md`.

## File Structure and Changes

### 1. Runtime Integration (Module Registration)

#### `/crates/stf/stf-declaration/src/lib.rs`
**Purpose**: Registers the Veritas modules with the Sovereign SDK runtime.
**Changes Made**: Added three new module fields to the Runtime struct.
**Why**: This is how Sovereign SDK discovers and wires up modules - they must be fields in the Runtime.

```rust
pub struct Runtime<S: Spec> {
    // ... existing modules ...
    
    /// The Veritas Agent module for managing agents and their stakes
    pub veritas_agent: veritas_agent::AgentModule<S>,
    
    /// The Veritas Belief module for managing beliefs/prediction markets
    pub veritas_belief: veritas_belief::BeliefModule<S>,
    
    /// The Veritas Submission module for orchestrating belief submissions
    pub veritas_submission: veritas_submission::SubmissionModule<S>,
}
```

#### `/crates/stf/stf-declaration/Cargo.toml`
**Purpose**: Declares module dependencies.
**Changes Made**: Added dependencies for the three Veritas modules.
**Why**: Rust needs to know where to find the module code.

```toml
[dependencies]
veritas-agent = { path = "../../../examples/veritas-agent" }
veritas-belief = { path = "../../../examples/veritas-belief" }
veritas-submission = { path = "../../../examples/veritas-submission" }
```

#### `/Cargo.toml` (workspace root)
**Purpose**: Adds modules to the workspace.
**Changes Made**: Added the three module paths to workspace members.
**Why**: Cargo workspace management - allows modules to be built together.

```toml
[workspace]
members = [
    # ... existing members ...
    "examples/veritas-agent",
    "examples/veritas-belief", 
    "examples/veritas-submission",
]
```

### 2. Core Module Implementations

#### `/examples/veritas-agent/src/lib.rs`
**Purpose**: Manages agents (participants) in the belief system.
**Architecture Role**: 
- Stores agent stake (voting power) and reputation scores
- Provides weight calculation (stake × score)
- Handles agent registration and stake management

**Key Components**:
- `Agent` struct: Holds stake and score
- `AgentModule`: Main module with StateMap storage
- `CallMessage`: Exposes RegisterAgent, AddStake, WithdrawStake
- Genesis: Initializes agents from config

#### `/examples/veritas-belief/src/lib.rs`
**Purpose**: Manages prediction markets/beliefs and their consensus values.
**Architecture Role**:
- Stores questions about future events
- Maintains weighted aggregate consensus
- Implements the weighted average formula

**Key Components**:
- `Belief` struct: Holds question, aggregate, total_weight
- `BeliefModule`: Main module with beliefs StateMap
- Internal method `update_aggregate`: Core aggregation logic
- Genesis: Loads initial beliefs from config

#### `/examples/veritas-submission/src/lib.rs`
**Purpose**: Orchestrates the submission process and coordinates modules.
**Architecture Role**:
- Entry point for agent predictions
- Coordinates cross-module calls
- Calculates score rewards (not applied)

**Key Components**:
- `Submission` struct: Records historical submissions
- `SubmissionModule`: Contains references to other modules via `#[module]`
- `CallMessage`: Exposes SubmitBelief
- Cross-module orchestration logic

### 3. Configuration Files

#### `/configs/mock/genesis.json`
**Purpose**: Initial state configuration for the rollup.
**Changes Made**: Added configuration for all three Veritas modules.
**Why**: Genesis sets up the initial blockchain state.

```json
{
  "veritas_agent": {
    "initial_agents": []  // Agents register dynamically
  },
  "veritas_belief": {
    "initial_beliefs": [
      // 5 prediction markets pre-configured
      {"id": 1, "question": "Will ETH exceed $5000?", "aggregate": 0.5, "total_weight": 0},
      // ... more beliefs
    ]
  },
  "veritas_submission": {
    "initial_submissions": []  // Created dynamically
  }
}
```

### 4. Client/Simulation Code

#### `/examples/starter-js/src/veritas-simulation.ts`
**Purpose**: Automated simulation that creates agents and submits beliefs.
**Why**: Tests the system by simulating real usage patterns.

#### `/examples/starter-js/src/veritas-test.ts`
**Purpose**: Simple test script for debugging transactions.
**Why**: Minimal test case for transaction validation.

#### `/examples/starter-js/src/veritas-monitor.ts`
**Purpose**: Monitors on-chain state via REST API.
**Why**: Allows observation of belief aggregation in real-time.

## Architecture Flow

```
1. GENESIS INITIALIZATION
   └─> Runtime loads genesis.json
       ├─> AgentModule.genesis() - Initialize agents
       ├─> BeliefModule.genesis() - Load beliefs 
       └─> SubmissionModule.genesis() - Initialize submissions

2. AGENT REGISTRATION
   └─> User calls veritas_agent.register_agent
       └─> AgentModule.call() processes transaction
           └─> Stores agent in StateMap

3. BELIEF SUBMISSION
   └─> User calls veritas_submission.submit_belief
       └─> SubmissionModule.call() orchestrates
           ├─> Calls AgentModule.get_weight()
           ├─> Calls BeliefModule.update_aggregate()
           └─> Stores submission record

4. AGGREGATION
   └─> BeliefModule.update_aggregate()
       └─> new_aggregate = (old × old_weight + new × new_weight) / total_weight
```

## Key Design Patterns

1. **Module Composition**: SubmissionModule references other modules via `#[module]` attribute
2. **State Storage**: StateMap for key-value, StateVec for lists, StateValue for singles
3. **Cross-Module Calls**: Internal methods (not CallMessage) for module-to-module
4. **Genesis Pattern**: Each module implements genesis() for initialization
5. **Type Conversion**: u64 in CallMessage (for UniversalWallet), f64 internally

## Common Issues and Solutions

1. **Empty GenesisConfig**: Breaks initialization - always provide structure
2. **Address Format**: REST API needs bech32, not hex addresses
3. **CallMessage for Internal Methods**: Don't expose internal methods in CallMessage
4. **Module References**: Use `#[module]` attribute for cross-module calls

## Learning Resources

- Original spec: `/specs/veritas-test-architecture.md`
- Integration explanation: `/examples/veritas-integration-explanation.md`
- Sovereign SDK Book: https://docs.sovereign.xyz/