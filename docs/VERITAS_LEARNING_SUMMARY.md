# Veritas Learning Summary

## What We Built
A simplified version of the Veritas protocol - a decentralized belief aggregation system where agents stake tokens to submit predictions about future events, with consensus emerging through weighted averaging.

## Files We Created/Modified (In Order of Importance)

### 1. Core Module Registration
**File**: `/crates/stf/stf-declaration/src/lib.rs`
**What we did**: Added three fields to the Runtime struct
**Why it matters**: This is THE integration point - without this, our modules don't exist to the blockchain

```rust
pub struct Runtime<S: Spec> {
    pub veritas_agent: veritas_agent::AgentModule<S>,
    pub veritas_belief: veritas_belief::BeliefModule<S>,
    pub veritas_submission: veritas_submission::SubmissionModule<S>,
}
```

### 2. The Three Core Modules

#### AgentModule (`/examples/veritas-agent/src/lib.rs`)
**What it does**: Manages participants
**Key concepts**:
- StateMap storage (key-value persistent storage)
- Module trait implementation (required for SDK integration)
- CallMessage enum (defines user-callable transactions)
- Genesis method (initializes state from config)

#### BeliefModule (`/examples/veritas-belief/src/lib.rs`)
**What it does**: Manages prediction markets
**Key concepts**:
- Weighted average algorithm implementation
- Internal vs external methods (update_aggregate is internal only)
- StateValue for counters (next_belief_id)

#### SubmissionModule (`/examples/veritas-submission/src/lib.rs`)
**What it does**: Orchestrates the system
**Key concepts**:
- Cross-module references via `#[module]` attribute
- Calling internal methods on other modules
- StateVec for append-only history
- Transaction orchestration pattern

### 3. Configuration
**File**: `/configs/mock/genesis.json`
**What we did**: Added initial state for all three modules
**Key learning**: Genesis config structure must match GenesisConfig structs

### 4. Dependencies
**Files**: 
- `/Cargo.toml` (workspace members)
- `/crates/stf/stf-declaration/Cargo.toml` (module dependencies)
**Key learning**: Modules must be in workspace AND declared as dependencies

## Key Patterns We Learned

### 1. Module Trait Pattern
Every module MUST implement the Module trait:
```rust
impl<S: Spec> Module for YourModule<S> {
    type Config = GenesisConfig<S>;  // Genesis configuration
    type CallMessage = CallMessage;   // User transactions
    
    fn genesis(...) { }  // Initialize from config
    fn call(...) { }     // Handle transactions
}
```

### 2. Cross-Module Communication
Modules reference each other and call internal methods:
```rust
pub struct SubmissionModule<S> {
    #[module]
    pub agent_module: veritas_agent::AgentModule<S>,
}

// Then call internal methods:
let weight = self.agent_module.get_weight(address, state)?;
```

### 3. State Storage Types
- `StateMap<K, V>`: Key-value storage
- `StateValue<T>`: Single value storage  
- `StateVec<T>`: Append-only list

### 4. Transaction Flow
```
User -> CallMessage -> Module.call() -> Internal logic -> State changes
```

## 🚨 Critical Lesson: Blockchain Determinism

**IMPORTANT**: Sovereign SDK modules CANNOT use floating-point numbers (f64/f32)!

### Why No Floats in Blockchain?
1. **Non-determinism**: Different CPUs/architectures produce slightly different float results
2. **Consensus Breaking**: All nodes MUST get EXACTLY the same result  
3. **Example**: `0.1 + 0.2` might be `0.30000000000000004` on one machine, `0.3` on another

### Solution: Fixed-Point Arithmetic
- Use integers (u64) with a fixed scale
- Scale of 10000 = 4 decimal places precision
- Examples:
  - 0.5 probability → 5000 (50% of 10000)
  - 0.7525 probability → 7525
  - 1.0 probability → 10000 (100%)

### Implementation Pattern
```rust
pub const SCALE: u64 = 10000;

// Convert percentage to fixed-point
let value_fixed = (percentage * SCALE) / 100;

// Weighted average with fixed-point
let result = (old_val * old_weight + new_val * new_weight) / total_weight;
```

## What Went Wrong and Why

### 1. Floating-Point Numbers in Modules
**Problem**: We used f64 for probability values (0.0 to 1.0)
**Why it failed**: Blockchain requires deterministic computation - floats are non-deterministic
**Fix**: Refactored to use u64 with fixed-point arithmetic (scale of 10000)

### 2. Empty GenesisConfig
**Problem**: We tried to simplify by making GenesisConfig empty structs
**Why it failed**: SDK expects proper structure for initialization
**Fix**: Proper GenesisConfig with fields (even if empty arrays)

### 2. Internal Methods in CallMessage
**Problem**: We exposed update_aggregate in CallMessage
**Why it failed**: Internal methods shouldn't be user-callable
**Fix**: Remove from CallMessage, call directly as internal method

### 3. Address Format
**Problem**: Used hex addresses (0x...) for REST API
**Why it failed**: SDK expects bech32 format (sov1...)
**Fix**: Need address conversion

## Key Takeaways

1. **Module Integration**: Modules must be fields in Runtime struct
2. **Genesis is Critical**: Proper genesis config and method implementation required
3. **Cross-Module Pattern**: Use `#[module]` references and internal method calls
4. **CallMessage vs Internal**: Only expose user-facing methods in CallMessage
5. **State Management**: Choose appropriate storage type (Map/Value/Vec)

## What This Implementation Demonstrates

- ✅ Basic module creation and integration
- ✅ Cross-module communication
- ✅ State storage patterns
- ✅ Transaction handling
- ✅ Genesis initialization
- ⚠️  Partial functionality (registration works, submissions don't)

## Next Steps for Learning

1. Debug why belief submissions fail (transaction validation)
2. Understand address format conversion (hex to bech32)
3. Learn about gas/fee handling in Sovereign SDK
4. Explore event emission for better observability
5. Understand the full transaction lifecycle

## Resources

- Original spec: `/specs/veritas-test-architecture.md`
- Implementation guide: `/docs/VERITAS_IMPLEMENTATION_GUIDE.md`
- Integration explanation: `/examples/veritas-integration-explanation.md`
- Module source code: `/examples/veritas-*/src/lib.rs`

## The Learning Journey

This implementation taught us:
1. How Sovereign SDK modules are structured
2. How modules communicate with each other
3. How state is persisted and managed
4. How transactions flow through the system
5. Common pitfalls and their solutions

Even though the full system isn't working, we've successfully:
- Created three interconnected modules
- Integrated them into the runtime
- Implemented complex cross-module logic
- Learned the SDK's patterns and requirements

This foundation provides the knowledge needed to build more complex systems on Sovereign SDK.