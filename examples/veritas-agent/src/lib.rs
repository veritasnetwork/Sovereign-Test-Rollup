//! AgentModule - Manages participants in the Veritas belief aggregation system
//!
//! FILE PURPOSE:
//! This is one of three core modules implementing the Veritas protocol.
//! It manages the participants (agents) who submit predictions to belief markets.
//!
//! ARCHITECTURE ROLE:
//! - First module in the flow: agents must register here before participating
//! - Provides weight calculation used by SubmissionModule
//! - Stores reputation scores that should increase with accuracy
//!
//! CHANGES MADE:
//! - Created from scratch following spec in /specs/veritas-test-architecture.md
//! - Implements Module trait for Sovereign SDK integration
//! - Uses StateMap for persistent storage of agents
//! - Exposes register/stake management via CallMessage
//!
//! This module handles:
//! - Agent registration with initial stake
//! - Stake management (add/withdraw)
//! - Reputation score tracking
//! - Weight calculation (stake × score)
//!
//! Each agent has:
//! - stake: Amount of tokens locked (influences voting power)
//! - score: Reputation score (starts at 100, increases with accurate predictions)

#![allow(unused_imports)]
use anyhow::{bail, Result};
use schemars::JsonSchema;
use sov_modules_api::macros::{serialize, UniversalWallet};
use sov_modules_api::{
    Context, Module, ModuleId, ModuleInfo, ModuleRestApi, Spec,
    StateMap, TxState,
};
use std::marker::PhantomData;

/// Agent represents a participant in the belief aggregation system
/// The agent's influence on belief aggregation is determined by stake × score
#[derive(Clone, Debug, borsh::BorshSerialize, borsh::BorshDeserialize, serde::Serialize, serde::Deserialize, JsonSchema)]
pub struct Agent {
    /// Amount of tokens staked by this agent
    /// Higher stake = more influence on belief aggregation
    pub stake: u64,
    
    /// Reputation score (starts at 100)
    /// Increases when agent's predictions are close to consensus
    pub score: u64,
}

/// AgentModule manages all agents in the system
/// 
/// The #[derive(ModuleInfo)] macro generates boilerplate for Sovereign SDK integration
/// The #[derive(ModuleRestApi)] macro auto-generates REST API endpoints
#[derive(Clone, ModuleInfo, ModuleRestApi)]
pub struct AgentModule<S: Spec> {
    /// Unique identifier for this module instance
    /// Required by Sovereign SDK for module identification
    #[id]
    pub id: ModuleId,

    /// StateMap stores agent data keyed by their blockchain address
    /// StateMap is Sovereign SDK's persistent key-value storage
    /// All changes are automatically persisted to the rollup's state tree
    #[state]
    pub agents: StateMap<S::Address, Agent>,

    /// PhantomData is needed to satisfy Rust's type system
    /// since we use generic type S but don't store it directly
    #[phantom]
    pub phantom: PhantomData<S>,
}

/// Module trait implementation defines how this module integrates with Sovereign SDK
/// This is the REQUIRED interface that the runtime uses to interact with our module.
/// Without this trait implementation, the module cannot be added to the Runtime.
/// The Sovereign SDK will call these methods at appropriate times:
/// - genesis() when the blockchain starts for the first time
/// - call() when a user submits a transaction to this module
impl<S: Spec> Module for AgentModule<S> {
    /// The blockchain specification (includes address type, crypto, etc.)
    type Spec = S;
    
    /// Configuration type used during genesis (initial chain state)
    type Config = GenesisConfig<S>;
    
    /// Enum of all possible transactions this module can process
    type CallMessage = CallMessage;
    
    /// Events emitted by this module (we're not using events currently)
    type Event = ();

    /// Initialize the module's state from genesis configuration
    fn genesis(
        &mut self,
        _header: &<S::Da as sov_modules_api::DaSpec>::BlockHeader,
        config: &Self::Config,
        state: &mut impl sov_modules_api::GenesisState<S>,
    ) -> Result<()> {
        // Initialize agents from genesis config
        for (address, agent) in &config.initial_agents {
            self.agents.set(address, agent, state)?;
        }
        Ok(())
    }

    /// Main entry point for processing transactions
    /// Called by the runtime when a transaction targets this module
    /// 
    /// Parameters:
    /// - msg: The decoded transaction message
    /// - context: Transaction context (sender, block height, etc.)
    /// - state: State accessor for reading/writing blockchain state
    fn call(
        &mut self,
        msg: Self::CallMessage,
        context: &Context<Self::Spec>,
        state: &mut impl TxState<S>,
    ) -> Result<()> {
        match msg {
            CallMessage::RegisterAgent { initial_stake } => {
                self.register_agent(initial_stake, context, state)
            }
            CallMessage::AddStake { amount } => {
                self.add_stake(amount, context, state)
            }
            CallMessage::WithdrawStake { amount } => {
                self.withdraw_stake(amount, context, state)
            }
        }
    }
}

#[derive(Clone, Debug, borsh::BorshSerialize, borsh::BorshDeserialize, serde::Serialize, serde::Deserialize, JsonSchema)]
pub struct GenesisConfig<S>
where
    S: Spec,
    S::Address: serde::Serialize + for<'a> serde::Deserialize<'a>,
{
    pub initial_agents: Vec<(S::Address, Agent)>,
}

impl<S: Spec> AgentModule<S> {
    /// Registers a new agent in the system with an initial stake
    /// 
    /// This is called when a user wants to participate in belief aggregation
    /// They must provide an initial stake which determines their voting power
    /// 
    /// Flow:
    /// 1. Extract sender address from transaction context
    /// 2. Check if agent already exists (prevent double registration)
    /// 3. Validate stake is non-zero
    /// 4. Create new Agent with default score of 100
    /// 5. Store in StateMap
    pub fn register_agent(
        &mut self,
        initial_stake: u64,
        context: &Context<S>,
        state: &mut impl TxState<S>,
    ) -> Result<()> {
        // context.sender() returns the address that signed this transaction
        let sender = context.sender();
        
        // StateMap.get returns Result<Option<T>>
        // - Ok(Some(agent)) means agent exists
        // - Ok(None) means agent doesn't exist
        // - Err means storage error
        if self.agents.get(sender, state)?.is_some() {
            bail!("Agent already registered");
        }

        if initial_stake == 0 {
            bail!("Initial stake must be greater than zero");
        }

        let agent = Agent {
            stake: initial_stake,
            score: 100, // Everyone starts with score 100
        };

        // StateMap.set persists the agent to blockchain state
        // The ? operator propagates any storage errors
        self.agents.set(sender, &agent, state)?;
        
        Ok(())
    }

    pub fn add_stake(
        &mut self,
        amount: u64,
        context: &Context<S>,
        state: &mut impl TxState<S>,
    ) -> Result<()> {
        let sender = context.sender();
        let agent = self.agents.get(sender, state)?
            .ok_or_else(|| anyhow::anyhow!("Agent not registered"))?;
        
        let updated_agent = Agent {
            stake: agent.stake.saturating_add(amount),
            score: agent.score,
        };
        
        self.agents.set(sender, &updated_agent, state)?;
        
        Ok(())
    }

    pub fn withdraw_stake(
        &mut self,
        amount: u64,
        context: &Context<S>,
        state: &mut impl TxState<S>,
    ) -> Result<()> {
        let sender = context.sender();
        let agent = self.agents.get(sender, state)?
            .ok_or_else(|| anyhow::anyhow!("Agent not registered"))?;
        
        if agent.stake < amount {
            bail!("Insufficient stake balance");
        }

        let updated_agent = Agent {
            stake: agent.stake.saturating_sub(amount),
            score: agent.score,
        };
        
        self.agents.set(sender, &updated_agent, state)?;
        
        Ok(())
    }

    pub fn update_score(
        &mut self,
        address: S::Address,
        delta: u64,
        state: &mut impl TxState<S>,
    ) -> Result<()> {
        let agent = self.agents.get(&address, state)?
            .ok_or_else(|| anyhow::anyhow!("Agent not registered"))?;
        
        let updated_agent = Agent {
            stake: agent.stake,
            score: agent.score.saturating_add(delta),
        };
        
        self.agents.set(&address, &updated_agent, state)?;

        Ok(())
    }

    /// Calculates an agent's weight for belief aggregation
    /// Weight = stake × score
    /// 
    /// This is a helper method used by SubmissionModule to determine
    /// how much influence an agent's prediction should have
    /// 
    /// Uses saturating_mul to prevent overflow (caps at u64::MAX)
    pub fn get_weight(&self, address: &S::Address, state: &mut impl TxState<S>) -> Result<u64> {
        let agent = self.agents.get(address, state)?
            .ok_or_else(|| anyhow::anyhow!("Agent not registered"))?;
        Ok(agent.stake.saturating_mul(agent.score))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, JsonSchema, UniversalWallet)]
#[serialize(Borsh, Serde)]
#[serde(rename_all = "snake_case")]
pub enum CallMessage {
    RegisterAgent { initial_stake: u64 },
    AddStake { amount: u64 },
    WithdrawStake { amount: u64 },
}

