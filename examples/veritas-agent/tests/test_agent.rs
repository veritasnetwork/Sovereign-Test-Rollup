#[cfg(test)]
mod tests {
    use veritas_agent::{Agent, AgentModule, CallMessage};
    use sov_modules_api::test_utils::generate_address;
    use sov_modules_api::{Context, Module, WorkingSet};
    use sov_address::{EthereumAddress, EvmCryptoSpec};
    use sov_state::DefaultStorageSpec;
    
    type TestSpec = sov_modules_api::configurable_spec::ConfigurableSpec<
        sov_mock_da::MockDaSpec,
        sov_mock_zkvm::MockZkvm,
        sov_mock_zkvm::MockZkvm,
        EthereumAddress,
        sov_rollup_interface::execution_mode::Native,
        EvmCryptoSpec,
        sov_state::nomt::prover_storage::NomtProverStorage<
            DefaultStorageSpec<sha2::Sha256>,
            <sov_mock_da::MockDaSpec as sov_rollup_interface::da::DaSpec>::SlotHash,
        >,
    >;

    #[test]
    fn test_agent_registration() {
        let mut module = AgentModule::<TestSpec>::default();
        let mut working_set = WorkingSet::<TestSpec>::new(Default::default());
        let sender = generate_address::<TestSpec>("test_sender");
        
        let context = Context::new(sender.clone(), Default::default(), 1);
        
        // Register agent
        let result = module.call(
            CallMessage::RegisterAgent { initial_stake: 1000 },
            &context,
            &mut working_set,
        );
        
        assert!(result.is_ok());
        
        // Check agent was registered
        let agent = module.agents.get(&sender, &mut working_set).unwrap();
        assert_eq!(agent.stake, 1000);
        assert_eq!(agent.score, 100);
    }
    
    #[test]
    fn test_duplicate_registration_fails() {
        let mut module = AgentModule::<TestSpec>::default();
        let mut working_set = WorkingSet::<TestSpec>::new(Default::default());
        let sender = generate_address::<TestSpec>("test_sender");
        
        let context = Context::new(sender.clone(), Default::default(), 1);
        
        // First registration should succeed
        module.call(
            CallMessage::RegisterAgent { initial_stake: 1000 },
            &context,
            &mut working_set,
        ).unwrap();
        
        // Second registration should fail
        let result = module.call(
            CallMessage::RegisterAgent { initial_stake: 2000 },
            &context,
            &mut working_set,
        );
        
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("already registered"));
    }
    
    #[test]
    fn test_stake_operations() {
        let mut module = AgentModule::<TestSpec>::default();
        let mut working_set = WorkingSet::<TestSpec>::new(Default::default());
        let sender = generate_address::<TestSpec>("test_sender");
        
        let context = Context::new(sender.clone(), Default::default(), 1);
        
        // Register agent
        module.call(
            CallMessage::RegisterAgent { initial_stake: 1000 },
            &context,
            &mut working_set,
        ).unwrap();
        
        // Add stake
        module.call(
            CallMessage::AddStake { amount: 500 },
            &context,
            &mut working_set,
        ).unwrap();
        
        let agent = module.agents.get(&sender, &mut working_set).unwrap();
        assert_eq!(agent.stake, 1500);
        
        // Withdraw stake
        module.call(
            CallMessage::WithdrawStake { amount: 200 },
            &context,
            &mut working_set,
        ).unwrap();
        
        let agent = module.agents.get(&sender, &mut working_set).unwrap();
        assert_eq!(agent.stake, 1300);
    }
    
    #[test]
    fn test_weight_calculation() {
        let mut module = AgentModule::<TestSpec>::default();
        let mut working_set = WorkingSet::<TestSpec>::new(Default::default());
        let sender = generate_address::<TestSpec>("test_sender");
        
        let context = Context::new(sender.clone(), Default::default(), 1);
        
        // Register agent with stake 1000 and default score 100
        module.call(
            CallMessage::RegisterAgent { initial_stake: 1000 },
            &context,
            &mut working_set,
        ).unwrap();
        
        // Weight should be stake * score = 1000 * 100 = 100,000
        let weight = module.get_weight(&sender, &mut working_set).unwrap();
        assert_eq!(weight, 100_000);
    }
}