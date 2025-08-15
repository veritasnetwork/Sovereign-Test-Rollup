# Veritas Modules Integration Explanation

## How the Modules Were Integrated into the Sovereign SDK Rollup

### 1. Module Creation Structure

Each Veritas module was created as a separate Rust crate in the `examples/` directory:
```
examples/
├── veritas-agent/      # Agent management module
├── veritas-belief/     # Belief/prediction market module
└── veritas-submission/ # Submission orchestration module
```

### 2. Workspace Configuration

The modules were added to the workspace in the root `Cargo.toml`:
```toml
[workspace]
members = [
  # ... existing members
  "examples/veritas-agent",
  "examples/veritas-belief",
  "examples/veritas-submission",
]

[workspace.dependencies]
# Module dependencies added here
veritas-agent = { path = "./examples/veritas-agent" }
veritas-belief = { path = "./examples/veritas-belief" }
veritas-submission = { path = "./examples/veritas-submission" }
```

### 3. Runtime Integration

The modules were integrated into the Runtime at `crates/stf/stf-declaration/src/lib.rs`:

```rust
#[derive(Clone, Default, Genesis, Hooks, DispatchCall, Event, MessageCodec, RuntimeRestApi)]
pub struct Runtime<S: Spec> {
    // ... existing modules
    
    /// Veritas modules
    pub veritas_agent: veritas_agent::AgentModule<S>,
    pub veritas_belief: veritas_belief::BeliefModule<S>,
    pub veritas_submission: veritas_submission::SubmissionModule<S>,
}
```

The Sovereign SDK macros automatically:
- **Genesis**: Generates genesis initialization from JSON config
- **DispatchCall**: Routes transactions to appropriate modules
- **MessageCodec**: Handles serialization/deserialization
- **RuntimeRestApi**: Creates REST endpoints for each module

### 4. Dependency Management

Each module's `Cargo.toml` specifies:
- Core dependencies (anyhow, borsh, serde, schemars)
- Sovereign SDK dependencies (sov-modules-api, sov-state)
- Inter-module dependencies (veritas-submission depends on the other two)

### 5. Cross-Module Communication

The SubmissionModule demonstrates cross-module calls:
```rust
pub struct SubmissionModule<S: Spec> {
    // Module references allow cross-module calls
    #[module]
    pub agent_module: veritas_agent::AgentModule<S>,
    
    #[module]
    pub belief_module: veritas_belief::BeliefModule<S>,
}
```

This allows SubmissionModule to call public methods on other modules:
```rust
// Get agent weight from AgentModule
let weight = self.agent_module.get_weight(sender, state)?;

// Update belief aggregate in BeliefModule  
let new_aggregate = self.belief_module.update_aggregate(belief_id, value, weight, state)?;
```

### 6. State Management

Three types of state storage were used:

1. **StateMap**: Key-value storage for agents and beliefs
   ```rust
   pub agents: StateMap<S::Address, Agent>
   ```

2. **StateValue**: Single value storage for counters
   ```rust
   pub next_belief_id: StateValue<u64>
   ```

3. **StateVec**: Append-only list for submissions
   ```rust
   pub submissions: StateVec<Submission<S>>
   ```

### 7. Transaction Flow

When a user submits a belief prediction:

1. **Transaction Creation**: User creates a CallMessage
   ```javascript
   {
     veritas_submission: {
       submit_belief: { belief_id: 1, value: 75 }
     }
   }
   ```

2. **Runtime Routing**: The Runtime's DispatchCall routes to SubmissionModule

3. **Module Processing**: SubmissionModule.call() processes the transaction

4. **Cross-Module Calls**: 
   - Calls AgentModule.get_weight()
   - Calls BeliefModule.update_aggregate()

5. **State Updates**: All state changes are atomically committed

### 8. API Generation

The Sovereign SDK automatically generates REST APIs:

- `GET /modules/veritas-agent/state/agents/{address}` - Get agent info
- `GET /modules/veritas-belief/state/beliefs/{id}` - Get belief state
- `POST /transactions` - Submit transactions

### 9. Genesis Configuration

The `genesis.json` initializes module state:
```json
{
  "veritas_agent": {
    "initial_agents": [
      ["0xAddress", {"stake": 1000, "score": 100}]
    ]
  },
  "veritas_belief": {
    "initial_beliefs": [
      {"id": 1, "question": "...", "aggregate": 0.5, "total_weight": 0}
    ]
  }
}
```

### 10. Build System Integration

The modules compile as part of the rollup:
```bash
cargo build --release  # Builds all modules
cargo run             # Runs the rollup with modules
```

## Key Design Decisions

1. **Separate Modules**: Each concern (agents, beliefs, submissions) is a separate module for clarity and reusability

2. **Cross-Module References**: SubmissionModule orchestrates by referencing other modules, demonstrating composition

3. **Type Safety**: Using u64 instead of f64 for UniversalWallet compatibility

4. **State Patterns**: Different storage types (Map, Value, Vec) for different use cases

5. **Genesis Seeding**: Pre-configured test data for immediate experimentation

This architecture demonstrates Sovereign SDK's modular design philosophy where complex systems are built by composing simpler, focused modules.