import type { ProviderStatus, VisualProposalRequest } from '@ultida/contracts';

type Environment = Record<string, string | undefined>;

export function createProviderGateway(environment: Environment) {
  const providers: ProviderStatus[] = [
    { id: 'pedra', configured: Boolean(environment.PEDRA_API_KEY), operations: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'] },
    { id: 'ai-home-design', configured: Boolean(environment.AI_HOME_DESIGN_API_KEY), operations: ['generate', 'restage', 'material-swap', 'remove-object', 'enhance'] }
  ];

  return {
    status: () => providers,
    async createVisualProposal(request: VisualProposalRequest) {
      const order = request.providerPreference.length ? request.providerPreference : providers.map((provider) => provider.id);
      const selected = order.map((id) => providers.find((provider) => provider.id === id)).find((provider) => provider?.configured && provider.operations.includes(request.operation));
      if (!selected) return { status: 'unavailable' as const, synthetic: true, reason: 'No configured provider supports this operation.', sourceSceneVersionId: request.sceneVersionId };
      return { status: 'queued' as const, synthetic: true, provider: selected.id, sourceSceneVersionId: request.sceneVersionId, operation: request.operation };
    }
  };
}
