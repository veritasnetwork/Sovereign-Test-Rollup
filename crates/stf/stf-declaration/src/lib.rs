#![allow(unused_doc_comments)]
//! This module implements the core logic of the rollup.
//! To add new functionality to your rollup:
//!   1. Add a new module dependency to your `Cargo.toml` file
//!   2. Add the module to the `Runtime` below
//!   3. Update `genesis.json` with any additional data required by your new module

use sov_hyperlane_integration::{
    warp::Warp, HyperlaneAddress, InterchainGasPaymaster, Mailbox as RawMailbox, MerkleTreeHook,
};
#[cfg(feature = "native")]
use sov_modules_api::macros::{expose_rpc, CliWallet};
use sov_modules_api::prelude::*;
use sov_modules_api::{DispatchCall, Event, Genesis, Hooks, MessageCodec, Spec};

pub type Mailbox<S> = RawMailbox<S, Warp<S>>;

/// The runtime defines the logic of the rollup.
///
/// At a high level, the rollup node receives serialized "call messages" from the DA layer and executes them as atomic transactions.
/// Upon reception, the message is deserialized and forwarded to an appropriate module.
///
/// The module-specific logic is implemented by module creators, but all the glue code responsible for message
/// deserialization/forwarding is handled by a rollup `runtime`.
///
/// To define the runtime, we need to specify all the modules supported by our rollup (see the `Runtime` struct below)
///
/// The `Runtime` defines:
/// - how the rollup modules are wired up together.
/// - how the state of the rollup is initialized.
/// - how messages are dispatched to appropriate modules.
///
/// Runtime lifecycle:
///
/// 1. Initialization:
///     When a rollup is deployed for the first time, it needs to set its genesis state.
///     The `#[derive(Genesis)]` macro will generate a `Runtime::genesis(config)` method which returns
///     `Storage` with the initialized state.
///
/// 2. Calls:
///     The `Module` interface defines a `call` method which accepts a module-defined type and triggers the specific `module logic.`
///     In general, the point of a call is to change the module state, but if the call throws an error,
///     no state is updated (the transaction is reverted).
///
/// `#[derive(MessageCodec)]` adds deserialization capabilities to the `Runtime` (by implementing the `decode_call` method).
/// `Runtime::decode_call` accepts a serialized call message and returns a type that implements the `DispatchCall` trait.
///  The `DispatchCall` implementation (derived by a macro) forwards the message to the appropriate module and executes its `call` method.
#[derive(Clone, Default, Genesis, Hooks, DispatchCall, Event, MessageCodec, RuntimeRestApi)]
#[cfg_attr(feature = "native", derive(CliWallet), expose_rpc)]
#[genesis(serde(bound = "S::Address: serde::de::DeserializeOwned + serde::Serialize"))]
pub struct Runtime<S: Spec>
where
    S::Address: HyperlaneAddress,
{
    /// The `accounts` module is responsible for managing user accounts.
    pub accounts: sov_accounts::Accounts<S>,
    /// The uniqueness module.
    pub uniqueness: sov_uniqueness::Uniqueness<S>,
    /// The bank module is responsible for minting, transferring, and burning tokens
    pub bank: sov_bank::Bank<S>,
    /// The sequencer registry module is responsible for authorizing users to sequencer rollup transactions
    pub sequencer_registry: sov_sequencer_registry::SequencerRegistry<S>,
    /// The operator incentives module.
    pub operator_incentives: sov_operator_incentives::OperatorIncentives<S>,
    /// The Attester Incentives module.
    pub attester_incentives: sov_attester_incentives::AttesterIncentives<S>,
    /// The Prover Incentives module.
    pub prover_incentives: sov_prover_incentives::ProverIncentives<S>,
    /// The Chain state module.
    pub chain_state: sov_chain_state::ChainState<S>,
    /// The Blob storage module.
    pub blob_storage: sov_blob_storage::BlobStorage<S>,
    /// The Paymaster module.
    pub paymaster: sov_paymaster::Paymaster<S>,
    /// The Revenue Share module.
    pub revenue_share: sov_revenue_share::RevenueShare<S>,
    /// The hyperlane mailbox
    pub mailbox: Mailbox<S>,
    /// The hyperlane interchain gas paymaster
    pub interchain_gas_paymaster: InterchainGasPaymaster<S>,
    /// The hyperlane merkle tree hook
    pub merkle_tree_hook: MerkleTreeHook<S>,
    /// The hyperlane warp route module
    pub warp: Warp<S>,
    /// The ValueSetter module (recommended as a starting point for building new modules)
    pub value_setter: value_setter::ValueSetter<S>,
    
    // ===== VERITAS MODULES =====
    // These three modules work together to implement a decentralized belief aggregation system
    // They demonstrate cross-module communication and complex state management
    
    /// The Veritas Agent module for managing agents and their stakes
    /// Handles: registration, stake management, reputation scores
    /// Called by: Users directly (register, add/withdraw stake)
    pub veritas_agent: veritas_agent::AgentModule<S>,
    
    /// The Veritas Belief module for managing beliefs/prediction markets
    /// Handles: belief creation, aggregate tracking, weighted averaging
    /// Called by: SubmissionModule (for aggregate updates)
    pub veritas_belief: veritas_belief::BeliefModule<S>,
    
    /// The Veritas Submission module for orchestrating belief submissions
    /// This is the main entry point for agents to submit predictions
    /// It coordinates between AgentModule and BeliefModule
    /// Called by: Users (to submit predictions)
    pub veritas_submission: veritas_submission::SubmissionModule<S>,
}
