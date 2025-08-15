//! SubmissionModule - Orchestrates belief submissions and scoring
//!
//! This is the main interaction point for agents. It coordinates:
//! - Accepting agent predictions
//! - Calculating agent weights via AgentModule
//! - Updating belief aggregates via BeliefModule
//! - Computing score rewards based on accuracy
//! - Recording submission history
//!
//! This module demonstrates cross-module communication in Sovereign SDK
//! by referencing and calling methods on other modules

#![allow(unused_imports)]
use anyhow::{bail, Result};
use schemars::JsonSchema;
use sov_modules_api::macros::{serialize, UniversalWallet};
use sov_modules_api::{
    Context, Module, ModuleId, ModuleInfo, ModuleRestApi, Spec, StateVec, TxState,
};
use std::marker::PhantomData;
use veritas_belief::BeliefId;

/// Records a single prediction submission
/// Stored for historical analysis and audit purposes
#[derive(
    Clone,
    Debug,
    borsh::BorshSerialize,
    borsh::BorshDeserialize,
    serde::Serialize,
    serde::Deserialize,
    JsonSchema,
)]
pub struct Submission<S: Spec> {
    /// Address of the agent who made this submission
    pub agent: S::Address,

    /// Which belief this prediction is for
    pub belief_id: BeliefId,

    /// The probability value submitted (0.0 to 1.0)
    pub value: f64,

    /// The agent's weight at time of submission (stake × score)
    pub weight: u64,

    /// Block timestamp when submission was made
    /// Currently set to 0 (TODO: get from context)
    pub timestamp: u64,
}

/// SubmissionModule orchestrates the belief submission process
///
/// KEY DESIGN: Cross-module references
/// The #[module] attribute allows this module to reference other modules
/// This enables cross-module method calls, demonstrating how modules
/// can work together in Sovereign SDK
#[derive(Clone, ModuleInfo, ModuleRestApi)]
pub struct SubmissionModule<S: Spec> {
    #[id]
    pub id: ModuleId,

    /// StateVec is an append-only list structure
    /// Perfect for storing historical records that don't need updates
    /// All submissions are kept for audit and analysis
    #[state]
    pub submissions: StateVec<Submission<S>>,

    /// Reference to AgentModule for weight calculations
    /// The #[module] attribute tells Sovereign SDK this is a module reference
    /// Allows calling public methods like get_weight()
    #[module]
    pub agent_module: veritas_agent::AgentModule<S>,

    /// Reference to BeliefModule for updating aggregates
    /// Demonstrates module composition pattern
    #[module]
    pub belief_module: veritas_belief::BeliefModule<S>,

    #[phantom]
    pub phantom: PhantomData<S>,
}

impl<S: Spec> Module for SubmissionModule<S> {
    type Spec = S;
    type Config = GenesisConfig<S>;
    type CallMessage = CallMessage;
    type Event = ();

    /// Initialize the module's state from genesis configuration
    fn genesis(
        &mut self,
        _header: &<S::Da as sov_modules_api::DaSpec>::BlockHeader,
        config: &Self::Config,
        state: &mut impl sov_modules_api::GenesisState<S>,
    ) -> Result<()> {
        // Initialize submissions from genesis config (usually empty)
        for submission in &config.initial_submissions {
            self.submissions.push(submission, state)?;
        }
        Ok(())
    }

    /// Entry point for transaction processing
    ///
    /// NOTE: We accept value as u64 (0-100) instead of f64 (0.0-1.0)
    /// This is because the UniversalWallet trait doesn't support f64
    /// We convert to f64 internally for calculations
    fn call(
        &mut self,
        msg: Self::CallMessage,
        context: &Context<Self::Spec>,
        state: &mut impl TxState<S>,
    ) -> Result<()> {
        match msg {
            CallMessage::SubmitBelief { belief_id, value } => {
                // Convert from percentage (0-100) to probability (0.0-1.0)
                let value_f64 = value as f64 / 100.0;
                self.submit_belief(belief_id, value_f64, context, state)
            }
        }
    }
}

#[derive(
    Clone,
    Debug,
    borsh::BorshSerialize,
    borsh::BorshDeserialize,
    serde::Serialize,
    serde::Deserialize,
    JsonSchema,
)]
#[serde(bound = "S::Address: serde::Serialize + serde::de::DeserializeOwned")]
pub struct GenesisConfig<S>
where
    S: Spec,
{
    pub initial_submissions: Vec<Submission<S>>,
}

impl<S: Spec> SubmissionModule<S> {
    /// Main submission logic - orchestrates the entire prediction process
    ///
    /// This demonstrates the power of module composition:
    /// 1. Gets agent weight from AgentModule
    /// 2. Updates belief aggregate in BeliefModule
    /// 3. Calculates score rewards
    /// 4. Records submission history
    ///
    /// FLOW:
    /// 1. Validate input
    /// 2. Get agent's weight (stake × score) via cross-module call
    /// 3. Update belief aggregate via cross-module call
    /// 4. Calculate score bonus based on accuracy
    /// 5. Store submission record
    pub fn submit_belief(
        &mut self,
        belief_id: BeliefId,
        value: f64,
        context: &Context<S>,
        state: &mut impl TxState<S>,
    ) -> Result<()> {
        if value < 0.0 || value > 1.0 {
            bail!("Value must be between 0.0 and 1.0");
        }

        let sender = context.sender();

        // CROSS-MODULE CALL #1: Get agent's weight from AgentModule
        // This demonstrates how modules can call each other's public methods
        let weight = self.agent_module.get_weight(sender, state)?;
        if weight == 0 {
            bail!("Agent has no weight (stake × score = 0)");
        }

        // CROSS-MODULE CALL #2: Update belief aggregate in BeliefModule
        // The new aggregate is returned so we can calculate score rewards
        let new_aggregate = self
            .belief_module
            .update_aggregate(belief_id, value, weight, state)?;

        // SCORING MECHANISM:
        // Agents are rewarded based on how close their prediction is to consensus
        // Distance 0.0 = perfect match = ~100 point bonus
        // Distance 0.5 = far off = ~2 point bonus
        let distance = (value - new_aggregate).abs();
        let _score_delta = (100.0 / (1.0 + (distance * 100.0))) as u64;

        // TODO: Currently we can't update scores because update_score is not exposed
        // in AgentModule's CallMessage. In a real implementation, we'd either:
        // 1. Add UpdateScore to CallMessage (but restrict who can call it)
        // 2. Make SubmissionModule a friend module with special access
        // 3. Use a different scoring mechanism

        // Record submission for historical tracking
        let submission = Submission {
            agent: sender.clone(),
            belief_id,
            value,
            weight,
            timestamp: 0, // TODO: Get actual from the chain-state module
        };

        // StateVec.push appends to the list
        self.submissions.push(&submission, state)?;

        Ok(())
    }

    pub fn get_submissions(
        &self,
        belief_id: BeliefId,
        state: &mut impl TxState<S>,
    ) -> Result<Vec<Submission<S>>> {
        let mut result = Vec::new();
        let len = self.submissions.len(state)?;

        for i in 0..len {
            if let Some(submission) = self.submissions.get(i, state)? {
                if submission.belief_id == belief_id {
                    result.push(submission);
                }
            }
        }

        Ok(result)
    }

    pub fn get_all_submissions(&self, state: &mut impl TxState<S>) -> Result<Vec<Submission<S>>> {
        let mut result = Vec::new();
        let len = self.submissions.len(state)?;

        for i in 0..len {
            if let Some(submission) = self.submissions.get(i, state)? {
                result.push(submission);
            }
        }

        Ok(result)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, JsonSchema, UniversalWallet)]
#[serialize(Borsh, Serde)]
#[serde(rename_all = "snake_case")]
pub enum CallMessage {
    SubmitBelief {
        belief_id: BeliefId,
        value: u64, // Changed to u64 (multiply by 100 for percentage)
    },
}
